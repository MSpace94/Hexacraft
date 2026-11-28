// Wiki du jeu : tout ce qu'il faut savoir, consultable en jouant (menu du jeu > Wiki).
// Les pages d'explications sont écrites ici ; les listes (recettes, four, blocs et objets,
// biomes, commandes) sont tirées des données du jeu : elles restent à jour toutes seules.
// Une recherche parcourt tout (textes, noms des blocs et objets, recettes).

import { METALS } from './metals.js?v=1.1.0-mx09tneh';

// Les nouveaux minerais (voir metals.js) : une ligne du tableau « Où trouver les minerais »
const PICK = { 3: 'pioche en pierre', 4: 'pioche en fer', 5: 'pioche en fluorite', 6: 'pioche en platine', 7: 'pioche en tungstène', 8: 'pioche en cramoisite' };
const BIOMES = { 5: 'les montagnes', 8: 'le désert', 9: 'les plaines enneigées', 10: 'les volcans' };
function metalRow(m) {
  const where = [];
  if (m.surf) where.push(`de ${m.surf[1]} à ${m.surf[0]}`);
  if (m.deep) where.push(`de ${m.deep[1]} à ${m.deep[0]}`);
  if (m.abyss) where.push(`l'abîme (sous -80${m.abyss[1] < -81 ? ', sous ' + m.abyss[1] : ''})`);
  const boost = m.boost ? ` (plus nombreux dans ${BIOMES[m.boost[0]]})` : '';
  const gives = m.key === 'diamant' ? 'un diamant (pour le bloc de diamant, décoratif)' : m.gem ? `${m.gem[0]} à ${m.gem[1]} cristaux` : `minerai, à fondre au four (${m.productName.toLowerCase()})`;
  return `<tr><td>${m.name[0].toUpperCase() + m.name.slice(1)}</td><td>${where.join(', ')}${boost}</td><td>${PICK[m.tier]}</td><td>${gives}</td></tr>`;
}

// Pages écrites : [id, titre, HTML]
const PAGES = [
  ['bases', 'Pour commencer', `
    <p>HexaCraft est un jeu de construction dans un monde fait d'<b>hexagones</b> : chaque bloc est
    un prisme à six côtés. On casse, on récolte, on fabrique et on construit.</p>
    <h3>Deux modes de jeu</h3>
    <ul>
      <li><b>Créatif</b> : tous les blocs à volonté (touche <kbd>E</kbd>), on vole (double appui sur
      <kbd>Espace</kbd>), on ne peut pas mourir.</li>
      <li><b>Survie</b> : il faut récolter et fabriquer. 12 cœurs de vie, les chutes, la lave, le
      froid et la noyade font mal.</li>
    </ul>
    <p>On change de mode avec <code>/gamemode survie</code> ou <code>/gamemode creatif</code>.</p>
    <h3>Sauvegarde</h3>
    <p>Le monde est sauvegardé tout seul, et en quittant par le menu du jeu. Les parties restent
    quand on installe une nouvelle version du jeu.</p>
    <h3>Infos utiles</h3>
    <ul>
      <li><kbd>F1</kbd> : masquer toute l'interface (captures d'écran, vidéos) ; encore F1 pour la retrouver.</li>
      <li><kbd>F3</kbd> : position, biome, heure, nombre d'images par seconde…</li>
      <li><kbd>F5</kbd> / <kbd>V</kbd> : changer de vue (première personne, de dos, de face).</li>
      <li><b>Torches</b> : sur le dessus d'un bloc, ou contre son côté (elle penche alors
      vers l'extérieur). Si le bloc qui la tient est cassé, elle tombe.</li>
      <li><kbd>Maj</kbd> au sol : <b>s'accroupir</b>. On avance lentement et on ne tombe pas du
      bord d'un bloc (pratique pour construire au-dessus du vide). En vol ou dans l'eau, Maj fait
      descendre.</li>
      <li>La <b>carte du monde</b> (menu du jeu) montre les biomes, et la météo si on coche la case.</li>
    </ul>
    <h3>La main secondaire</h3>
    <p><kbd>F</kbd> échange l'objet en main avec celui de la <b>main secondaire</b> (la main gauche). Sa case est à gauche de la barre.</p>
    <h3>La tablette</h3>
    <p>Une tablette (3 verres en haut ; fer, circuit, fer ; fer, voltite, fer) ouvre <b>YouTube</b> et <b>Twitch</b> sur son écran (boutons « YouTube » et « Twitch » en haut). Tenue (en main, ou
    mieux dans la main secondaire), elle reste en bas de la vue : on regarde une vidéo ou un live en jouant, en marchant, aux commandes
    de son vaisseau. <kbd>U</kbd> (ou un clic droit quand elle est en main) : on la <b>prend en main</b>, elle vient devant soi et la
    souris sert à cliquer dessus. <b>Le jeu ne se met pas en pause</b>. <kbd>Échap</kbd>, ✕ ou un clic dans le jeu : on reprend la main.
    On y cherche des vidéos (la recherche se fait sur le site affiché), on regarde les <b>lives</b> (bouton « Lives »), et en se connectant
    (« Se connecter » sur YouTube, « Connexion » sur Twitch) on utilise <b>son compte</b> : ses abonnements ou chaînes suivies
    (bouton « Abonnements »), les commentaires, le chat des lives. La connexion reste sur la tablette. Quand la vidéo fait du son, la musique du
    jeu se tait ; ranger la tablette met la vidéo en pause. La tablette n'ouvre que YouTube, Twitch et la page de connexion de Google. Dans
    la version web du jeu, on y colle seulement le lien d'une vidéo ou d'un live YouTube, ou d'une chaîne Twitch (sans compte ni chat).</p>`],
  ['survie', 'Survie', `
    <h3>Vie</h3>
    <p>12 cœurs (24 points). Elle remonte toute seule, lentement, 4 secondes après le dernier coup.</p>
    <h3>Ce qui fait mal</h3>
    <ul>
      <li><b>Chute</b> : au-delà de 3 blocs, 1 point par bloc en plus. Tomber dans l'eau amortit tout.</li>
      <li><b>Noyade</b> : 15 secondes de souffle sous l'eau, puis 1 cœur par seconde.</li>
      <li><b>Lave</b> : elle brûle, et on continue de brûler quelques secondes après en être sorti
      (les cœurs prennent feu). L'eau éteint le feu.</li>
      <li><b>Froid</b> : l'eau glaciale (bleu ciel, près des terres enneigées) fait geler au bout de
      quelques secondes ; les cœurs se couvrent de givre et on perd de la vie.</li>
      <li><b>Le vide</b> : tomber sous le monde est mortel.</li>
      <li><b>Mode hardcore</b> : une seule vie, des dégâts une fois et demie plus forts. Mort, la
      partie est finie : on peut encore regarder le monde en spectateur.</li>
      <li><b>TNT</b> et <b>tornades</b> (qui projettent en l'air : gare à la chute).</li>
    </ul>
    <h3>Mourir</h3>
    <p>On réapparaît au point d'apparition du monde.</p>`],
  ['meubles', 'Coffres et meubles', `
    <h3>Le double coffre</h3>
    <p>Deux coffres posés côte à côte, à la même hauteur, n'en font plus qu'un : un grand coffre d'une seule
    pièce, avec un grand loquet sur l'avant (du côté où regardent les coffres) et des charnières derrière, de
    <b>60 cases</b>, qui s'ouvre en entier par l'un ou l'autre. Chacun garde ses 30 cases : en casser un
    ne fait tomber que ce qu'il contenait. Trois coffres en rangée font un double coffre et un simple.</p>
    <h3>Les meubles</h3>
    <p>Un onglet à part dans le créatif, « Meubles ». Chacun se fabrique à l'établi. Les meubles
    orientés (chaises, canapés, fauteuil, commode, banc, boîte aux lettres) se tournent vers toi quand tu
    les poses.</p>
    <ul>
      <li><b>Intérieur</b> : tables et chaises en chêne et en noyer, tabouret, canapés rouge et bleu,
      fauteuil vert, pouf, commode, bibliothèque, lampe de chevet (elle éclaire), plante en pot, tapis
      rouge et bleu, caisse en bois.</li>
      <li><b>Extérieur</b> : banc de jardin, table de jardin en fer forgé, lampadaire (il éclaire fort),
      parasol, jardinière fleurie, tonneau, poubelle, boîte aux lettres.</li>
    </ul>
    <ul>
      <li><b>S'asseoir</b> : clic droit sur une chaise, un tabouret, un canapé, le fauteuil, le pouf ou
      le banc. Espace ou Maj pour te lever.</li>
      <li><b>Grands canapés</b> : pose des canapés de la même couleur côte à côte, tournés du même côté ;
      ils se relient en un seul long canapé (accoudoirs seulement aux deux bouts).</li>
      <li><b>Tapis</b> : des tapis de la même couleur posés les uns à côté des autres forment un seul grand
      tapis, avec la bordure tout autour.</li>
      <li><b>Commode</b> : on y range ses affaires comme dans un coffre (30 cases, clic droit pour l'ouvrir).</li>
    </ul>`],
  ['outils', 'Outils et minerais', `
    <h3>Les paliers d'outils</h3>
    <p>Chaque palier casse plus vite et permet de récolter de meilleurs minerais :</p>
    <ol>
      <li><b>Bois</b> : le premier outil. Une pioche en bois ne détache de la pierre que des cailloux.</li>
      <li><b>Rustique</b> (cailloux) : récupère la pierre taillée.</li>
      <li><b>Pierre</b> : récolte le <b>fer</b>, la <b>voltite impure</b>, le <b>cuivre</b>, l'<b>aluminium</b> et le <b>quartz</b>.</li>
      <li><b>Fer</b> (ou <b>aluminium</b> : mêmes outils, même puissance) : récolte la <b>voltite</b>, la <b>fluorite</b>, l'<b>obsidienne</b>, le <b>silicium</b>, la <b>magnétite</b> et le <b>plomb</b>.</li>
      <li><b>Fluorite</b> : récolte le <b>platine</b> et le <b>gallium</b>.</li>
      <li><b>Platine</b> : récolte le <b>tungstène</b>, le <b>titane</b> et le <b>diamant</b>.</li>
      <li><b>Tungstène</b> : récolte la <b>cramoisite</b>, l'<b>iridium</b> et l'<b>uranite</b>.</li>
      <li><b>Cramoisite</b> : le plus rapide ; récolte la <b>gravitite</b>.</li>
    </ol>
    <p>Pioche pour la pierre et les minerais, hache pour le bois, pelle pour la terre et le sable.
    Sans le bon outil, un minerai ne donne rien.</p>
    <h3>Durabilité (survie)</h3>
    <p>Chaque outil s'use : 1 utilisation par bloc cassé (2 pour l'épée), 1 par coup d'épée (2
    avec un autre outil). Ce qui se casse d'un coup (torches, plantes...) ne l'use pas. Une barre
    sous l'icône montre ce qui reste (du vert au rouge), et l'infobulle le nombre exact ; à zéro,
    l'outil casse.</p>
    <table class="wiki-table">
      <tr><th>Matière</th><th>Utilisations</th></tr>
      <tr><td>Bois, châtaignier, tilleul, bouleau, érable, noyer, bouleau alien, olivier, ginkgo, liquidambar</td><td>60</td></tr>
      <tr><td>Rustique</td><td>100</td></tr>
      <tr><td>Pierre</td><td>132</td></tr>
      <tr><td>Fer</td><td>250</td></tr>
      <tr><td>Fluorite</td><td>400</td></tr>
      <tr><td>Platine</td><td>600</td></tr>
      <tr><td>Tungstène</td><td>1500</td></tr>
      <tr><td>Cramoisite</td><td>3000</td></tr>
    </table>
    <h3>Les profondeurs</h3>
    <p>Le monde descend jusqu'en <b>-80</b>, où se trouve la bedrock. Sous 0 : la pierre, les
    minerais rares et des <b>lacs de lave souterrains</b> (entre -72 et -20, sous une voûte).
    Dans les endroits visités avant cette mise à jour, la bedrock est restée en 0 : cherche une
    <b>brèche</b> (de la pierre à la place de la bedrock) pour descendre.</p>
    <h3>Où trouver les minerais</h3>
    <table class="wiki-table">
      <tr><th>Minerai</th><th>Hauteur</th><th>Il faut</th><th>Donne</th></tr>
      <tr><td>Charbon</td><td>dans la pierre, jusqu'à -24</td><td>une pioche</td><td>du charbon</td></tr>
      <tr><td>Fer</td><td>sous 80, jusqu'à -40</td><td>pioche en pierre</td><td>minerai, à fondre au four</td></tr>
      <tr><td>Voltite impure</td><td>de 34 à 2</td><td>pioche en pierre</td><td>2 à 5 voltites impures</td></tr>
      <tr><td>Fluorite</td><td>de 5 à -15</td><td>pioche en fer</td><td>minerai, à fondre au four</td></tr>
      <tr><td>Voltite</td><td>de -10 à -30</td><td>pioche en fer</td><td>2 à 4 voltites</td></tr>
      <tr><td>Platine</td><td>de -24 à -54</td><td>pioche en fluorite</td><td>minerai, à fondre au four</td></tr>
      <tr><td>Tungstène</td><td>de -60 à -80</td><td>pioche en platine</td><td>minerai, à fondre au four</td></tr>
      <tr><td>Cramoisite</td><td>de -50 à -80 (deux fois plus rare que le tungstène)</td><td>pioche en tungstène</td><td>minerai, à fondre au four</td></tr>
      ${METALS.map(metalRow).join('')}
    </table>
    <p>Au-dessus de 0, les endroits déjà visités avant une mise à jour gardent leurs anciens minerais :
    les nouveaux (cuivre, aluminium, quartz…) n'apparaissent que dans les endroits encore jamais explorés.</p>
    <h3>À quoi servent les nouveaux minerais</h3>
    <ul>
      <li><b>Cuivre</b> : bobines de cuivre, câbles haute tension, tuyaux, circuits intégrés.</li>
      <li><b>Aluminium</b> : roues, hélices, ports d'amarrage (léger).</li>
      <li><b>Quartz</b> : verre renforcé (visière du casque spatial), céramique.</li>
      <li><b>Silicium</b> : plaquettes pour les circuits intégrés et les panneaux solaires.</li>
      <li><b>Magnétite</b> : fondue, elle donne des aimants (le noyau des transformateurs).</li>
      <li><b>Plomb</b> : les plaques des batteries de stockage.</li>
      <li><b>Gallium</b> : les cellules des panneaux solaires.</li>
      <li><b>Titane</b> : le réservoir de fusée avancé.</li>
      <li><b>Iridium</b> : le réacteur au nédrolytium.</li>
      <li><b>Uranite</b> : de l'uranium raffiné (pour plus tard).</li>
      <li><b>Gravitite</b> : le générateur de gravité.</li>
      <li><b>Diamant</b> : seulement décoratif (9 diamants font un bloc de diamant).</li>
    </ul>
    <p>Le concasseur tire deux poussières d'un minerai (chacune fond en un lingot), 4 quartz d'un
    minerai de quartz et 2 diamants d'un minerai de diamant.</p>`],
  ['hexaliens', 'Les Hexaliens', `
    <p>De petites créatures d'un bloc et demi, toutes plates (en 2D), qui vivent dans de petites
    grottes entre -20 et -10 : un sol de mousse, une voûte basse, des champignons lumineux.</p>
    <ul>
      <li>Ils se sont adaptés à la vie sous terre : sans lumière, <b>ils brillent d'eux-mêmes</b>.</li>
      <li><b>Parfaitement inoffensifs</b>, ils te prennent pour l'un des leurs : ils te saluent, te
      suivent un moment, et sautent de joie quand tu sautes.</li>
      <li>Le reste du temps, ils se promènent, s'assoient, mangent ou dorment.</li>
      <li>Frappé, un Hexalien est étourdi, puis vexé un instant. Il ne se venge jamais.</li>
    </ul>`],
  ['mines', 'Mines abandonnées', `
    <p>Une ancienne compagnie minière a creusé un réseau ferré dans les profondeurs, entre -30 et
    -80, puis l'a abandonné. On en trouve une dans la plupart des grandes zones du monde.</p>
    <h3>Ce qu'on y trouve</h3>
    <ul>
      <li><b>Des galeries</b> de 5 de large, à la taille du train, sur 2 ou 3 étages (-37, -55, -73).</li>
      <li><b>Un puits</b> avec un escalier en colimaçon relie les étages. Dans les endroits jamais
      visités avant, il débouche à la surface, entre trois poteaux de bois.</li>
      <li><b>Des salles</b> là où les galeries se croisent, et des <b>coffres</b> pleins de matériel
      (fer, rails de train, torches, parfois un wagonnet ou une lampe de casque).</li>
      <li>Des étais de bois, des lampes éteintes, des minerais rares dans les parois.</li>
    </ul>
    <h3>La voie</h3>
    <ul>
      <li><b>La voie</b> : de vrais rails de train, prêts à rouler (pose une locomotive dessus).</li>
      <li><b>Trous dans la voie</b> : pose des rails de train.</li>
      <li><b>Éboulements</b> : du gravier et de la pierre sur la voie, à dégager.</li>
    </ul>
    <h3>Le matériel du mineur</h3>
    <ul>
      <li><b>Wagonnet de mine</b> : un wagon à atteler. Ce que tu casses à moins de 7 blocs de lui
      tombe directement dedans.</li>
      <li><b>Lampe de casque</b> : se porte sur la tête et éclaire devant toi. Indispensable : sous
      terre, il fait noir.</li>
    </ul>`],
  ['voltite', 'Voltite et circuits', `
    <p>La voltite sert à faire des circuits, comme la redstone de Minecraft.</p>
    <h3>Sources de courant</h3>
    <p>Bloc de voltite, torche d'énergie allumée, levier activé.</p>
    <h3>Levier analogique</h3>
    <p>Un levier à 16 crans, de 0 (coupé) à 15 (pleine puissance) : clic droit, un cran de plus ;
    <kbd>Maj</kbd> + clic droit, un de moins (maintenu, il défile). Ce qu'il alimente, fil compris,
    reçoit sa puissance : une <b>hélice</b> tourne plus ou moins vite (sa portance suit le cran : de quoi
    faire monter, planer ou descendre doucement un hélicoptère), un <b>bloc physique</b> pousse plus ou moins
    fort, des <b>roues</b> roulent plus ou moins vite. Un répéteur ou un émetteur sans fil redonne 15.
    Recette : voltite, levier et lingot de fer, en colonne.</p>
    <h3>Pistons et hélices couchés</h3>
    <p>Posé sur le sol, un piston pousse vers le haut (sous un plafond, vers le bas). Posé contre le
    <b>côté</b> d'un bloc, il se couche et pousse droit devant lui, en s'éloignant de ce bloc (les 6 directions) :
    de quoi faire des portes coulissantes ou pousser des blocs sur le côté (12 au plus ; l'agrippant les ramène).
    L'hélice aussi : contre le côté d'un bloc, elle se couche et son rotor (les blocs collés devant elle) tourne
    autour d'un axe à l'horizontale ; sur un objet collé, elle le tire vers l'avant, comme celle d'un avion.</p>
    <h3>Sans fil</h3>
    <p>Émetteur et récepteur de voltite : clic droit dessus avec un objet en main pour choisir leur
    fréquence. Au-dessus de chacun flotte l'icône de sa fréquence (orange : émetteur, cyan :
    récepteur ; la bordure brille quand il émet ou reçoit) : on voit d'un coup d'œil qui parle à qui.</p>
    <h3>Fils</h3>
    <ul>
      <li>On pose la voltite (rouge) ou la voltite impure (bleue) au sol : ça fait un fil.</li>
      <li>Le courant part à 15 d'une source et perd 1 par fil : au bout de 15 fils, il s'arrête.</li>
      <li>Les fils montent et descendent d'un bloc, comme des marches (un bloc juste au-dessus du
      fil du bas coupe la montée).</li>
      <li>Les deux voltites ne se relient pas entre elles, mais alimentent les mêmes choses.</li>
    </ul>
    <h3>Répéteurs</h3>
    <p>Le courant entre par l'arrière (le côté tourné vers toi quand tu le poses) et ressort à
    pleine force (15) devant, après 0,1 seconde, dans un seul sens. Le rouge alimente la voltite,
    le bleu la voltite impure ; ils acceptent les deux à l'arrière (un répéteur bleu derrière un fil
    rouge passe le courant au réseau bleu).</p>
    <h3>Inverseurs</h3>
    <p>Comme un répéteur (plaque plus sombre), mais à l'envers : <b>sans courant à l'arrière, il
    en donne devant</b> ; avec du courant à l'arrière, il n'en donne plus. Pratique pour une porte
    logique NON, une lampe qui s'éteint quand on lève un levier, ou une horloge (un inverseur dont
    la sortie revient à son arrière). Recette : une torche d'énergie posée sur un répéteur (rouge
    ou bleu).</p>
    <h3>Ce que le courant actionne</h3>
    <ul>
      <li><b>Lampe de voltite</b> : s'allume et éclaire.</li>
      <li><b>TNT</b> : s'allume et explose.</li>
      <li><b>Bloc physique</b> : collé à un objet, il le fait avancer (voir Objets physiques).</li>
      <li><b>Rails de propulsion</b> (clic droit pour les allumer à la main).</li>
    </ul>`],
  ['physique', 'Objets physiques', `
    <p>Des blocs collés ensemble deviennent un <b>objet</b> qui tombe, roule, flotte et se pousse,
    comme un vrai objet (bateau, voiture, avion…).</p>
    <h3>Construire un objet</h3>
    <ol>
      <li>Avec la <b>super colle</b>, clic droit sur chaque bloc à coller.</li>
      <li><kbd>Maj</kbd> + clic droit : les blocs collés deviennent un objet.</li>
      <li><kbd>Maj</kbd> + clic droit sur l'objet : il se repose dans le monde.</li>
    </ol>
    <h3>Le déplacer</h3>
    <ul>
      <li>En marchant dedans, on le pousse. On peut monter dessus et y construire : on reste
      attaché à lui quand il bouge (même en sautant).</li>
      <li>La <b>main gravitationnelle</b> attrape un objet (même très lourd), le lance
      (clic gauche), le rapproche (molette) et le tourne (<kbd>R</kbd> <kbd>F</kbd> <kbd>C</kbd>,
      <kbd>X</kbd> pour le redresser).</li>
      <li><b>Blocs physiques</b> : alimentés par du courant sur l'objet, ils le font avancer. La
      clé à molette règle leur vitesse et leur direction.</li>
      <li><b>Gravitron</b> : pilote l'objet vers une cible (missile, avion ou bateau). La cible peut
      être un <b>bloc cible</b> choisi dans la liste (tous ceux du monde) ; son nom se change à la
      clé à molette. Bouton <b>Parcours</b> : une suite de blocs cibles, avec le temps d'arrêt à
      chacun avant de repartir, et éventuellement une boucle (avion ou bateau).</li>
    </ul>
    <h3>Voitures</h3>
    <ul>
      <li><b>Roue</b> : une vraie roue ronde, à coller sous l'objet. Elles roulent vers l'avant et tiennent
      sur le côté ; celles de devant braquent pour tourner (on les voit tourner et braquer). Une roue monte
      une marche d'un bloc. Rien ne se pose sur une roue.</li>
      <li><b>Volant</b> : le siège du conducteur. Il donne l'avant de la voiture (le côté opposé à toi quand
      tu le poses). Clic droit : on s'assoit. <kbd>Z</kbd> / <kbd>S</kbd> accélérer, freiner puis reculer,
      <kbd>Q</kbd> / <kbd>D</kbd> tourner, <kbd>Espace</kbd> freiner, <kbd>Maj</kbd> se lever. Personne au
      volant : frein à main.</li>
      <li>Les roues doivent recevoir du courant pour avancer (un levier, un bloc de voltite, un fil qui les
      touche, ou un levier posé sur le bloc juste au-dessus d'une roue : il l'alimente à travers lui). Avec
      un <b>levier analogique</b>, la vitesse suit son cran (jusqu'à 86 km/h à 15).</li>
      <li><b>Pilote de route</b> : il conduit tout seul. Clé à molette : une destination ou un
      <b>Parcours</b> de blocs cibles (temps d'arrêt à chacun, boucle), comme le gravitron. Coincé, il
      recule un peu et réessaie. Sans volant, c'est lui qui donne l'avant. (Le gravitron a aussi un mode
      Voiture.)</li>
      <li>Sans volant ni pilote de route, les roues roulent dans tous les sens : un chariot à roulettes à pousser.</li>
    </ul>
    <h3>À savoir</h3>
    <ul>
      <li>Le bois flotte, la pierre coule : chaque bloc a sa masse réelle.</li>
      <li>En pleine mer, les vagues bercent les objets ; les tornades les emportent.</li>
      <li>Circuits, lampes et répéteurs marchent aussi sur un objet.</li>
      <li>Un objet trop loin (au-delà de la distance d'affichage) est mis en pause et reprend
      quand on revient.</li>
    </ul>`],
  ['transport', 'Rails et Hexacarts', `
    <ul>
      <li>On pose des <b>rails</b> au sol ; ils se relient et tournent tout seuls.</li>
      <li>Clic droit avec un <b>Hexacart</b> sur un rail : il s'y pose. Clic droit dessus : on monte.</li>
      <li><kbd>Z</kbd> à bord : pousser. <kbd>Maj</kbd> : descendre.</li>
      <li><b>Rails de propulsion</b> : accélèrent l'Hexacart quand ils sont allumés (clic droit ou
      courant). Le booster en diamant va encore plus vite.</li>
    </ul>`],
  ['train', 'Le train', `
    <ul>
      <li>Le train roule sur sa propre voie, les <b>rails de train</b>. Il est énorme : chaque voiture
      fait 3 blocs de large et une dizaine de cases de long ; il faut au moins 11 rails à la suite pour
      poser la locomotive.</li>
    </ul>
    <h3>La voie</h3>
    <ul>
      <li>Un rail de train se pose dans l'axe du regard. Clic droit sur un rail de train : la ligne droite
      continue devant lui. Les rails voisins dans le même axe se relient tout seuls.</li>
      <li><b>Virage</b> : <kbd>Maj</kbd> + clic droit avec un rail de train sur un bout de voie (le départ),
      puis clic droit là où la voie doit arriver : une grande courbe douce les relie, sur plusieurs
      cases. Elle peut monter ou descendre en pente douce. <kbd>Maj</kbd> + clic droit : annuler.</li>
      <li>Un virage trop serré est refusé (le train est long) : place l'arrivée plus loin. En survie, il
      coûte un rail de train pour 2 cases.</li>
      <li>Casser un bout de voie enlève aussi son virage.</li>
      <li><b>Aiguillage</b> : un virage peut partir d'un rail qui a déjà une voie de ce côté (deux sorties :
      le tout droit et la branche). Clic droit sur ce rail : l'aiguillage bascule ; le panneau à côté de la
      voie est vert pour le tout droit, orange pour la branche. Les wagons suivent toujours le chemin pris
      par la locomotive.</li>
      <li>Commande <b>/voie x1 z1 x2 z2</b> (ajoute <b>double</b> pour deux voies côte à côte) : trace toute une
      ligne d'un point à l'autre, aussi longue qu'on veut, avec un grand virage si l'arrivée est décalée. Le passage est dégagé et
      le vide sous la voie comblé de gravier. Au-dessus d'un ravin, d'une vallée ou de l'eau, la commande construit un
      <b>pont</b> (tablier de pierre, parapets, une pile jusqu'au sol toutes les 8 cases) ; sous une montagne, un
      <b>tunnel</b> (parois et voûte là où la roche manque).</li>
      <li><b>Ligne spatiale</b> : voir la page Système solaire (<b>/voie espace glacia</b>).</li>
      <li><b>Pente</b> : pose le rail suivant de la voie un bloc plus haut (ou plus bas), au moins 4 cases plus
      loin dans le même axe : les deux se relient en pente (1 bloc toutes les 4 cases au plus, jusqu'à 16 cases).</li>
      <li><b>Aiguillage à l'énergie</b> : un fil de voltite allumé, un levier ou une source qui touche le rail de
      l'aiguillage le fait passer sur la branche ; sans courant, il revient tout droit.</li>
      <li><b>Gare</b> : un bloc à poser à côté de la voie (à moins de 6 cases). Les trains en pilote automatique
      s'y arrêtent 10 secondes, la cabine en face de la gare, puis repartent en sifflant. Clic droit sur la gare :
      lui donner un nom (il s'affiche dans le train et sur la carte).</li>
    </ul>
    <h3>Le train</h3>
    <ul>
      <li>Clic droit avec la <b>locomotive</b> sur un rail : elle se pose dans le sens du regard. Les
      <b>wagons</b> se posent sur la voie juste derrière : ils s'attellent tout seuls, sans limite de nombre : plus le train est long et chargé, plus il est lourd (plus lent à démarrer, il consomme plus).</li>
      <li>Clic droit sur la locomotive : on s'assoit dans la cabine, face au pare-brise. <kbd>Z</kbd>
      avance, <kbd>S</kbd> freine puis recule, clic gauche : le klaxon, <kbd>H</kbd> : le sifflet, <kbd>Maj</kbd> :
      descendre. Un écran de bord montre la vitesse, la prochaine gare, le prochain aiguillage et le bout de la voie.</li>
      <li><b>Pilote automatique</b> (<kbd>P</kbd> dans la cabine) : le train garde sa vitesse (<kbd>Z</kbd> / <kbd>S</kbd>
      pour la changer, <kbd>S</kbd> jusqu'à l'arrêt pour le couper), suit les aiguillages, s'arrête à chaque gare,
      ralentit avant le bout de la voie et derrière un autre train. Il continue même si on descend : de
      vraies lignes automatiques entre deux bases.</li>
      <li><b>Combustible</b> (survie) : la locomotive brûle du charbon ou du bois quand elle accélère (clic droit
      dessus, ou depuis la cabine, avec le combustible en main). Plus le train est long et chargé, moins il
      accélère et moins il va vite.</li>
      <li>Vue extérieure (<kbd>F5</kbd>) dans un train : la caméra recule pour voir tout le train. Dans les virages,
      la vue tourne avec la voiture.</li>
      <li>La nuit, les phares éclairent la voie et un feu rouge brille à l'arrière du dernier wagon ; la
      locomotive fume (plus fort quand elle accélère) et les roues font des étincelles au freinage.</li>
      <li>Clic droit sur un wagon : son inventaire (30 cases, comme un coffre). Il voyage avec le train ;
      casser le wagon rend ce qu'il contient.</li>
      <li>Au bout de la voie, le train s'arrête (il ne déraille jamais).</li>
      <li><b>Wagon plat</b> : il se pose comme un wagon. Son plateau est un vrai sol : on y construit ce
      qu'on veut (murs, coffres, machines…) et on y marche ; tout roule avec le train. Une base mobile !
      Casser le wagon plat rend ce qui était construit dessus.</li>
      <li><b>Wagon trémie</b> : il ramasse les objets tombés près de la voie (les cartons) quand il passe ; arrêté
      au-dessus d'un coffre posé sous les rails, il s'y vide tout seul. Clic droit : son contenu.</li>
      <li><b>Wagon passagers</b> : 6 places assises (clic droit : s'asseoir, <kbd>Maj</kbd> : se lever). En ligne,
      tous les joueurs peuvent voyager ensemble pendant que l'un conduit.</li>
      <li><b>Wagon poseur de rails</b> : donne-lui des rails de train et du gravier (clic droit : son coffre).
      Au bout de la voie, quand le train avance, il pose la suite devant lui, dégage le passage (les blocs
      enlevés vont dans son coffre) et comble le vide dessous.</li>
      <li><b>Wagon de queue</b> : une cabine à l'arrière du train (feux rouges, rétroviseurs). Clic droit dessus :
      on s'y assoit, et on conduit le train en marche arrière (<kbd>Z</kbd> recule, presque aussi vite qu'en avant).</li>
      <li><b>Wagon plat à étage</b> : deux plateaux, reliés par un escalier de deux marches ; on construit sur les deux
      niveaux, un garde-corps entoure l'étage.</li>
      <li><b>Locomotives à vapeur</b> : la <b>carénée</b> (noire et profilée, bande rouge : la plus rapide) et la
      <b>camouflée</b> (grandes roues rouges : elle tire fort, un train lourd la ralentit moins). Elles gardent leur
      chaudière (pas de moteur à poser, mais tous les composants), brûlent du charbon ou du bois, crachent de la fumée à
      chaque coup de piston et sifflent au clic gauche. On conduit debout, dans la cabine à l'arrière.</li>
      <li><b>Tender</b> : à atteler derrière une locomotive à vapeur ; c'est un coffre de combustible qui remplit tout
      seul la chaudière.</li>
      <li><b>Wagon couvert</b> : un wagon fermé vert olive (toit bombé, porte coulissante) ; clic droit : son coffre.</li>
      <li><b>Wagon blindé</b> : caisse blindée camouflée et deux tourelles à canon. Clic droit : on s'assoit sur la
      tourelle avant ; les deux tourelles suivent le regard, le clic gauche tire un obus qui explose comme une TNT
      là où il tombe (en survie, un obus de l'inventaire à chaque tir).</li>
      <li><b>La collection</b> (55 véhicules, onglet Train de l'inventaire) : 14 locomotives (Pacific 231 G, A3, A1,
      V2, 120, 220 américaine, 030 T, petite 030, locotracteur diesel, locomotives blindées, draisine blindée, petite
      locomotive de conte…), leurs 9 tenders, 11 voitures et fourgons, et 21 wagons. Chacun a sa longueur et sa vitesse.
      Les voitures ont leurs vraies places assises (clic droit : s'asseoir) ; les fourgons, wagons couverts, citernes,
      porte-conteneurs… sont des coffres ; la trémie céréalière ramasse comme le wagon trémie ; les wagons armés
      (wagon canon, DCA, tombereaux, wagon à tourelles) se manient comme le wagon blindé, assis sur la tourelle.</li>
      <li><b>Voyageurs</b> : des villageois vont attendre sur le quai de la gare de leur village, montent dans le wagon
      passagers d'un train qui s'y arrête, et descendent à une autre gare, où ils s'installent.</li>
      <li>Deux trains qui se touchent s'arrêtent net. Un train pousse les objets physiques qu'il percute
      (et ralentit s'ils sont lourds).</li>
      <li>Casser une voiture (la locomotive comme un wagon) ne rend qu'elle : le reste du train reste sur la voie.
      <b>Clic molette</b> sur une voiture, à pied : elle se détache de celle de devant ; sur la voiture de tête d'une
      rame, elle s'attelle au train tout proche (à moins de 3 blocs, dans le même sens).</li>
    </ul>
    <h3>La locomotive : composants et itinéraire</h3>
    <ul>
      <li><b>Clic molette</b> dans la cabine : le menu de la locomotive. Onglet <b>Composants</b> : un emplacement pour
      le moteur et 8 pour les composants (clic : en choisir un ; clic droit : l'enlever).</li>
      <li><b>Moteurs</b> (16) : du moteur diesel (83 km/h) au moteur à fusion plasma (270 km/h). Les moteurs thermiques
      brûlent du charbon ou du bois ; les électriques se rechargent avec de la voltite ; la fusion n'a besoin de rien.
      Chaque moteur se fabrique à partir du précédent.</li>
      <li><b>Composants</b> : réservoir de carburant (réservoir ×2), batterie, turbocompresseur (accélération),
      radiateur et pompe à carburant (consommation), cylindre de frein et réservoir d'air (freinage), sablière (pentes),
      faisceau de câbles et transformateur (moteurs électriques), manette de traction, alternateur (phares), pot
      d'échappement, avertisseur (un autre klaxon), moteur de traction (train moins lourd). Les 8 emplacements sont la seule
      limite : plusieurs composants pareils se cumulent.</li>
      <li><b>Composants de locomotive à vapeur</b> (19, sans effet sur les autres moteurs) : piston renforcé, surchauffeur,
      cylindre compound, cheminée à double tirage, échappement amélioré (accélération) ; régulateur de pression,
      distribution Walschaerts, ressort de suspension (vitesse) ; réchauffeur d'eau, calorifuge, grille de foyer, joint haute
      pression, manomètre double (consommation) ; chaudière haute pression (vitesse et accélération, mais consomme plus) ;
      chaudière renforcée, alimentateur de charbon (réservoir) ; compresseur d'air (freinage) ; essieu renforcé (wagons
      plus légers) ; plaque de blindage à vapeur (plus lourde, mais tient mieux les pentes).</li>
      <li>Onglet <b>Itinéraire</b> : les gares à desservir, dans l'ordre et en boucle. En pilote automatique, le train ne
      s'arrête qu'à celles-là et règle tout seul les aiguillages pour trouver le chemin le plus court.</li>
      <li>En gare, un carillon annonce l'arrivée (et la prochaine gare, à l'approche). Le moteur gronde de plus en plus
      fort avec la vitesse, et les freins grincent.</li>
    </ul>
    <h3>Équipements de la voie</h3>
    <ul>
      <li><b>Butoir</b> : à poser au bout d'une voie, il se tourne tout seul vers elle.</li>
      <li><b>Panneau de limitation de vitesse</b> : à poser à côté de la voie (clic droit : 20, 40, 60... 200 km/h,
      puis fin de limitation). Un train qui le passe ne dépasse plus cette vitesse jusqu'au panneau suivant (le pilote
      automatique ralentit avant).</li>
      <li><b>Détecteur de train</b> : sous la voie, il donne du courant de voltite quand une voiture passe dessus
      (portes, lampes, pistons, aiguillages...).</li>
    </ul>
    <h3>La casquette de conducteur</h3>
    <ul>
      <li>Offerte la première fois qu'on conduit une locomotive dans un monde (ou dans l'inventaire créatif). Elle se met
      dans l'emplacement <b>Tête</b> de l'inventaire, ou clic droit avec elle en main. Les autres joueurs la voient.</li>
    </ul>
    <h3>Fabrication</h3>
    <ul>
      <li>Les pièces se font à la table de craft avec de l'acier, du fer, du verre et du platine :
      essieux, bogies, longerons, plaques, vitres, voyants, ventilateur, calandre, pare-chocs, cabine.</li>
      <li>La locomotive et le wagon s'assemblent ensuite avec ces pièces.</li>
      <li>Wagon trémie : trémie, trappes, volant de trappe, couvercle, échelle. Wagon passagers : fenêtres,
      plafonnier, banquettes (sièges, table pliante, filet à bagages), porte coulissante, marchepieds. Wagon
      poseur de rails : pile de rails, pile de traverses, bras articulé, vérins, levier de commande.</li>
      <li>Gare : pierre taillée, verre, une plaque de destination et une lampe de quai.</li>
    </ul>`],
  ['industrie', 'Industrie', `
    <h3>Énergie</h3>
    <ul>
      <li>Une chaudière à vapeur brûle du charbon ou du bois ; chaque dynamo à vapeur qui la touche produit 40 W (3 chaudières au plus par dynamo).</li>
      <li>Une éolienne produit plus en altitude, et beaucoup plus par temps d'orage.</li>
      <li>Une roue à aubes tourne dans l'eau qui coule (l'eau calme ne donne presque rien).</li>
      <li>Les câbles haute tension relient sources, batteries et machines. Après 64 câbles, le réseau perd de l'énergie : un transformateur en relie 256 de plus.</li>
      <li>Une batterie de stockage garde le surplus (60 000 J) et le rend quand les sources ne suffisent plus.</li>
      <li>Vise un bloc du réseau : un compteur montre ce qu'il produit ou consomme, et l'état de tout le réseau.</li>
    </ul>
    <h3>Machines</h3>
    <ul>
      <li>Concasseur : un minerai donne 2 poussières, qui cuisent au four comme le minerai. Il réduit aussi la pierre en gravier puis en sable.</li>
      <li>Haut fourneau : à poser entre deux briques réfractaires (dessus et dessous), avec du combustible. Il fait de l'acier en quantité avec du minerai, des lingots ou de la poussière de fer.</li>
      <li>Laminoir : lingots de fer en rails, acier en plaques, plaques en tôle ondulée, acier sombre en rails de train.</li>
      <li>Foreuse : elle creuse la colonne sous elle et pose ce qu'elle trouve sur un tapis, dans un coffre qui la touche ou dans un wagon.</li>
      <li>Foreuse horizontale (la foreuse couchée, une case dans la grille de craft) : elle creuse droit devant elle, à l'opposé de toi quand tu la poses, jusqu'à 64 cases. De quoi percer un tunnel.</li>
      <li>Les machines ralentissent si le réseau manque de watts. Clic droit pour les ouvrir.</li>
    </ul>
    <h3>Tapis et bras</h3>
    <ul>
      <li>Un tapis roulant se tend entre deux arbres de transmission alignés : tapis en main, clic droit sur le premier arbre puis sur le second (20 cases au plus). Il va du premier vers le second.</li>
      <li>Il peut monter ou descendre : une marche par case, en diagonale. Un levier allumé contre une de ses poulies inverse son sens.</li>
      <li>Il porte plusieurs piles à la fois, une par case, qui glissent jusqu'au bout : sur le tapis suivant, dans le coffre, le four, la machine ou le wagon d'en face, ou par terre s'il n'y a rien.</li>
      <li>Clic droit sur un tapis : y poser ce qu'on tient, ou reprendre la pile visée. Un carton jeté dessus est emporté, et toi aussi si tu montes dessus.</li>
      <li>Casser une case du tapis le défait : ses poulies redeviennent des arbres.</li>
      <li>Tapis, bras et quais ont besoin d'un peu de courant (1 à 5 W) : relie-les au réseau par un câble (un tapis consomme 1 W par case).</li>
      <li>Un bras de transfert prend derrière lui (coffre, sortie d'un four ou d'une machine, tapis, wagon) et pose devant lui.</li>
    </ul>
    <h3>Automatisation</h3>
    <ul>
      <li>Pour automatiser une usine (comme dans le mod Create, mais à l'électricité) : relie chaque machine au réseau par un câble.</li>
      <li><b>Entonnoir électrique</b> : posé contre un coffre, un four ou une machine (il le regarde), il y range ce qui passe derrière lui : la pile du tapis qui le longe, celle qui arrive au bout d'un tapis, un carton posé là.</li>
      <li><b>Extracteur électrique</b> : l'inverse. Il sort ce que contient le coffre (ou ce qu'a produit la machine) et le pose derrière lui : sur un tapis, dans un coffre, ou par terre.</li>
      <li>Filtre : clic droit sur un entonnoir, un extracteur ou un bras avec un objet en main ; il ne laisse plus passer que cet objet. Main vide : plus de filtre. De quoi trier ce qui passe sur un tapis.</li>
      <li><b>Ventilateur électrique</b> : il souffle devant lui (6 cases) et pousse les cartons. Avec de la lave, du magma ou un four allumé derrière lui, il cuit ce qui passe dans son souffle (comme au four) ; avec de l'eau, il le lave (gravier : poussière de fer, sable : argile).</li>
      <li><b>Presse électrique</b> : posée au-dessus d'un tapis, elle arrête la pile qui passe dessous et l'aplatit (lingots de fer : rails, acier : plaques, plaques : tôle ondulée...).</li>
      <li><b>Scie électrique</b> : au-dessus d'un tapis, elle coupe les bûches en planches (deux de plus qu'à l'établi).</li>
      <li><b>Assembleur</b> : un coffre qui fabrique tout seul. Clic droit avec l'objet voulu en main pour le choisir, puis mets-y les ingrédients (à la main, ou avec des entonnoirs) : il fabrique et pose le résultat devant lui.</li>
      <li><b>Répartiteur</b> : ce qui y entre (bout d'un tapis, extracteur...) ressort par ses autres côtés, chacun son tour : pour partager une ligne entre plusieurs machines.</li>
      <li>Le wattmètre (clic droit en visant) dit ce que fait chaque bloc : son filtre, ce qu'il fabrique, ce que fait le ventilateur.</li>
    </ul>
    <h3>Trains de marchandises</h3>
    <ul>
      <li>Un quai de chargement remplit les wagons d'un train arrêté à côté avec le coffre qui le touche ; un quai de déchargement les vide dans ce coffre.</li>
      <li>Avec le pilote automatique, une ligne mine, usine, village tourne toute seule.</li>
      <li>Les villages proches d'une gare passent des commandes (acier, plaques, rails, tôle...) : livre-les en train à leur gare pour être payé en lingots de fer.</li>
      <li>Le forgeron, le maçon et le constructeur de véhicules achètent aussi tes produits.</li>
    </ul>
    <h3>Pollution</h3>
    <ul>
      <li>Chaudières, hauts fourneaux et machines enfument les environs : les feuilles se salissent, les animaux fuient et les villageois t'en veulent.</li>
      <li>Un filtre à fumée qui touche la machine la divise par 4 ; une cheminée d'usine posée dessus la divise par 2.</li>
    </ul>
    <h3>Machines sur un véhicule</h3>
    <ul>
      <li>Colle des machines sur un objet (Super colle) : concasseur, laminoir, haut fourneau, foreuses, chaudières, dynamos, éoliennes et batteries y marchent, sans câbles. Tout l'objet est un seul réseau.</li>
      <li>L'énergie : une dynamo touchée par une chaudière allumée à bord (la chaudière brûle son combustible quand il faut du courant), les éoliennes (le vent, et la vitesse du véhicule), les panneaux solaires. Les batteries de stockage à bord gardent le surplus.</li>
      <li>La foreuse creuse le monde sous elle (4 blocs), la foreuse horizontale devant elle (6 blocs) : là où le véhicule passe. Si seule la foreuse touche le sol, le véhicule s'enfonce à mesure qu'elle creuse.</li>
      <li>Ce qui sort des machines va dans les coffres du véhicule (ceux qui touchent la machine d'abord). Vise une machine du véhicule pour lire la production et la demande de son réseau.</li>
    </ul>`],
  ['tnt', 'TNT et explosifs', `
    <ul>
      <li>On allume une TNT avec une torche en main (clic droit) ou avec du courant.</li>
      <li>Plusieurs puissances : TNT, Big TNT, TNT 200, TNT 1000 (énorme).</li>
      <li>Les explosions cassent les blocs, poussent les objets physiques et font couler l'eau et la
      lave dans les trous.</li>
    </ul>`],
  ['eau', 'Eau et lave', `
    <ul>
      <li>L'eau et la lave coulent et remplissent les trous. La lave est plus lente.</li>
      <li>L'eau qui touche la lave la transforme en pierre taillée (lave qui coule) ou en
      obsidienne (source de lave).</li>
      <li>Près des terres enneigées, la mer est <b>glaciale</b> (bleu ciel) : on y gèle.</li>
      <li>En pleine mer, il y a des <b>vagues</b>, petites par beau temps, énormes dans la tempête.</li>
    </ul>
    <h3>Le seau</h3>
    <p>3 lingots de fer en V (comme dans Minecraft). Clic droit avec le seau vide sur une
    <b>source</b> d'eau (ou d'eau glaciale) : un <b>seau d'eau</b> ; sur une source de lave : un
    <b>seau de lave</b>. Clic droit avec un seau plein : la source est posée devant le bloc visé et le
    seau redevient vide. Le seau de trempe de la forge se fait maintenant avec un seau d'eau et un
    lingot de fer.</p>`],
  ['animaux', 'Animaux', `
    <h3>Le cochon</h3>
    <p>Le premier animal du jeu, fait d'hexagones comme tout le reste. Il vit en petits groupes
    dans les régions tempérées : plaines, forêts, grandes forêts et forêts européennes. Il se
    promène, s'arrête, regarde autour de lui, saute les marches et évite les falaises, l'eau et
    la lave. Dans l'eau, il flotte.</p>
    <ul>
      <li><b>Le frapper</b> : clic gauche. Il s'enfuit en courant. Il a 5 cœurs : à mains nues
      il faut 10 coups, avec une épée en bois 3 (plus l'épée est bonne, moins il en faut).</li>
      <li>Il laisse <b>1 à 3 côtelettes de porc crues</b> (cuites s'il brûlait).</li>
      <li>Les chutes, la lave et les explosions le blessent aussi.</li>
      <li>De nouveaux cochons apparaissent peu à peu sur l'herbe, loin des joueurs (une dizaine
      au plus autour de chacun).</li>
    </ul>
    <h3>Les moutons</h3>
    <p>Blancs ou gris, dans les mêmes régions que les cochons. Ils laissent <b>1 à 2 laines</b>
    (blanche ou grise), un bloc pour construire, et <b>1 à 2 gigots de mouton</b> (à cuire au four).</p>
    <h3>Renard polaire et lièvre arctique</h3>
    <p>Dans les régions froides, sur la neige. Le renard se promène seul ou à deux ; le lièvre
    détale dès qu'un joueur approche (accroupis-toi pour t'en approcher). Le renard laisse
    <b>1 à 2 viandes de renard</b> (à cuire au four) ; le lièvre ne laisse rien.</p>
    <h3>La vache</h3>
    <p>Noire et blanche, avec ses cornes, dans les mêmes régions que les cochons et les moutons.
    Clic droit sur une vache adulte avec un <b>seau vide</b> : on la trait, le seau devient un
    <b>seau de lait</b>. Elle laisse <b>1 à 3 steaks</b> (à cuire au four).</p>
    <ul>
      <li><b>Boire le lait</b> : clic droit, le seau de lait en main (comme manger) ; le seau revient vide.</li>
      <li><b>Fromage</b> : un seau de lait dans la grille d'artisanat donne 2 fromages ; le seau vide reste dans la grille.</li>
    </ul>
    <h3>Élevage</h3>
    <p>Comme dans Minecraft : clic droit sur un animal adulte avec sa nourriture à la main, il se met
    <b>en amour</b> (des cœurs, pendant 30 secondes). Deux animaux de la même espèce en amour se
    rejoignent et un <b>petit</b> naît. Le petit fait la moitié de la taille, suit ses parents et
    devient adulte en <b>20 minutes</b>, même quand tu es loin ; chaque fois que tu le nourris, il gagne
    2 minutes (10 fois : adulte tout de suite). Il ne
    laisse rien. Les parents attendent 5 minutes avant de recommencer.</p>
    <ul>
      <li><b>Cochon</b> : pomme de terre ou carotte. <b>Mouton</b> et <b>vache</b> : blé.
      <b>Lièvre</b> : graines de blé ou carotte. <b>Renard</b> : graines de blé.</li>
      <li>Un animal <b>suit</b> le joueur qui tient sa nourriture (le lièvre ne s'enfuit plus).</li>
      <li>Pour les garder : des <b>clôtures</b> (4 planches + 2 bâtons en deux lignes « P B P » :
      3 clôtures), une pour chaque bois. Elles se relient entre elles et aux blocs voisins, et font
      1,5 bloc de haut : ni le joueur ni les animaux ne sautent par-dessus. La <b>barrière</b>
      (4 bâtons + 2 planches, « B P B ») s'ouvre et se ferme au clic droit ; posée entre deux
      clôtures, elle se met dans leur alignement.</li>
    </ul>
    <h3>Zombies</h3>
    <p>Dès le <b>crépuscule</b>, avant même qu'on puisse dormir, des zombies sortent loin des
    joueurs (jamais dans un village), et plus vite au début de la nuit. Ils poursuivent les joueurs
    en survie et les villageois, bras tendus, et mordent (un cœur et demi par morsure). Les
    villageois s'enfuient en criant quand ils en voient un. Ils ont 10 cœurs et ne laissent rien.</p>
    <ul>
      <li><b>Ils doivent te voir</b> : de près, ils te sentent toujours ; plus loin, un mur ou une
      colline te cache. <b>Accroupi</b>, ils te repèrent deux fois moins loin.</li>
      <li><b>Ils se souviennent</b> de l'endroit où ils t'ont vu, et vont y voir un moment. Celui qui
      te repère <b>appelle les autres</b> autour de lui.</li>
      <li>À plusieurs, ils arrivent <b>par les côtés</b> pour t'encercler, et <b>contournent</b> les
      murs et les trous au lieu de buter dessus.</li>
      <li>Au soleil, ils brûlent peu à peu et <b>cherchent l'ombre</b> (un arbre, un surplomb). Sous un
      <b>orage</b>, le soleil ne les brûle plus, et ils sortent même le jour.</li>
      <li>Le jour, une meute de <b>hurleurs</b> rôde parfois : eux ne craignent pas le soleil.</li>
      <li>Impossible de dormir si un monstre est à moins de 16 blocs, ou s'il te poursuit.</li>
    </ul>
    <h3>Villageois</h3>
    <p>Ils vivent dans les <b>villages</b> des plaines : un puits au centre et des maisons
    hexagonales autour (dans les endroits encore jamais visités). Chaque maison a son habitant ;
    des enfants courent entre les maisons. Ils restent près de leur village.</p>
    <ul>
      <li><b>Clic droit sur un villageois</b> : le commerce (en survie). Celui qui a un métier
      vend ce qu'il produit (le bûcheron du bois, le mineur du charbon et du fer, le maçon du
      gravier...) ; les autres proposent 3 échanges, toujours les mêmes. La fenêtre dit aussi où en
      est le village.</li>
    </ul>
    <h3>La vie du village</h3>
    <p>Les villageois agrandissent leur village tout seuls, de jour (la nuit, ils rentrent chez
    eux) :</p>
    <ul>
      <li><b>S'installer</b> : chacun part couper un arbre, se fait un établi dans sa maison, puis
      un coffre pour y ranger son bois. Le premier installé pose le <b>coffre de la mairie</b> au
      fond de la grande maison : c'est là que le village réunit ses ressources.</li>
      <li><b>Les métiers</b> (chacun a ses vêtements), selon ce qui manque : bûcheron (coupe les
      arbres, replante), mineur (creuse un escalier en colimaçon éclairé, puis de grandes salles sous terre),
      maçon (bâtit), fermier (cultive le potager), pêcheur, berger (tond les moutons), puis des
      artisans (forgeron, armurier, boucher, tanneur, bibliothécaire, prêtre, cartographe).</li>
      <li><b>Les chantiers</b>, un à la fois : l'entrée de la mine, le potager, des routes de
      gravier jusqu'à chaque porte, puis de nouvelles maisons quand il n'y a plus assez de lits,
      et, une fois le village grand, des <b>petits immeubles</b> de trois étages (escalier en colimaçon).
      Le village n'a pas de limite : il s'étend de plus en plus loin du puits.
      S'il manque du bois ou de la pierre, le maçon va le demander au bûcheron ou au mineur.</li>
      <li><b>Le verre</b> : le mineur va chercher du sable (plages, déserts), se fabrique un four dans
      la mairie et y fait des vitres pour les fenêtres. Sans sable : fenêtres ouvertes.</li>
      <li><b>Le mécanicien</b> (village d'au moins 8 adultes) : avec le maçon, il bâtit une
      <b>plateforme de lancement</b> (son bloc cible apparaît dans la liste des gravitrons), puis y
      assemble jusqu'à trois véhicules physiques pour les joueurs. Monte dessus, choisis une
      destination au gravitron (clé à molette), lève le levier : il décolle. Pour revenir, choisis la
      plateforme. Il lui faut, à la mairie, des bûches, de la voltite et du fer.</li>
      <li><b>Les bâtisseurs</b> : le <b>charpentier</b> bâtit les maisons, immeubles, boutiques et
      la grange ; le <b>bâtisseur de champs</b> prépare les champs ; les <b>maçons</b> font le reste
      (mine, routes, mur, lampadaires) et aident les autres quand ils n'ont rien à faire.</li>
      <li><b>Les champs</b> : un trou d'eau entouré de 18 cases de terre labourée (blé et pommes de
      terre). Au plus 2 fermiers par champ : quand ils sont tous pris, un nouveau champ est préparé.
      La terre labourée devient humide (plus sombre) avec de l'eau à moins de 4 cases : les cultures
      y poussent deux fois plus vite.</li>
      <li><b>La boulangerie</b> : les fermiers apportent leur récolte au boulanger, qui en fait du
      pain et des pommes de terre cuites : de quoi nourrir le village et ses naissances.</li>
      <li><b>Les lits</b> : une maison loge autant de villageois qu'elle a de <b>lits de villageois</b>.
      Les bâtisseurs les posent (2 bûches par lit) contre les murs, sans boucher le passage, dans
      les maisons, les immeubles, l'hôtel et les étages des boutiques ; chacun dort dans le sien
      la nuit. C'est une capsule hexagonale de deux blocs de haut, en planches dehors et garnie de
      laine dedans, ouverte d'un côté : ses parois sont solides, on n'y entre que par
      l'ouverture. Tu peux en fabriquer (6 planches et 2 laines blanches : P L P / P L P / P P P)
      et en poser : l'ouverture se tourne vers toi. La nuit, clic droit sur un lit : tu t'y couches et
      tu te réveilles au matin (pas avec des monstres tout près).</li>
      <li><b>Les militaires</b> : parle à un villageois pour le recruter comme militaire (en survie,
      4 lingots de fer) et choisis sa tenue. Il quitte son village, te suit, combat les monstres
      autour de toi et te rejoint si tu pars loin à pied. Parle-lui pour lui donner des ordres :
      te suivre, garder sa position, ou retourner à la vie civile.</li>
      <li><b>La circulation</b> : dans les villages d'au moins 10 adultes, des <b>policiers</b> se
      postent aux carrefours ; dès 7 adultes (avec un mur ou une plateforme), un <b>gendarme</b>
      surveille les entrées du village et dégage la plateforme quand un véhicule arrive. Ils
      font passer les villageois chacun leur tour, et demandent aux joueurs trop rapides de
      ralentir.</li>
      <li><b>La pépinière</b> (dès 10 maisons) : un grand enclos de planches, à ciel ouvert, où les
      bûcherons plantent et coupent leurs arbres (7 places). Une fois bâtie, tous les autres arbres
      du village ne servent plus : les bûcherons abattent les troncs (sans replanter), les
      feuilleteurs retirent les feuilles et les forestiers arrachent les pousses (sauf celles que
      tu as plantées). Les bûcherons ne vont plus en forêt que s'il manque du bois.</li>
      <li><b>Les métiers des bois</b> : pour chaque bûcheron, un <b>forestier</b> (il retire les jeunes
      pousses sauvages), et un <b>feuilleteur</b> pour deux bûcherons (il retire les feuilles d'arbres
      qui touchent les bâtiments du village). Le village garde un <b>maçon</b> pour 6 adultes (routes,
      mur, lampadaires) : il en manque, un feuilleteur devient maçon.</li>
      <li><b>Les véhicules</b> : le <b>constructeur de véhicules</b> assemble des véhicules sur la
      plateforme de lancement, en même temps que le mécanicien. Le <b>chauffeur de taxi</b> attend
      à la plateforme : monte sur un véhicule, parle-lui (clic droit) et choisis ta destination
      parmi les blocs cibles du monde : il monte avec toi, règle le gravitron et lance le véhicule
      (en survie, un lingot de fer la course). Une fois arrivé, il attend que tu descendes, puis
      ramène le véhicule à la plateforme ; tes militaires montent avec toi. Le jour, il emmène parfois
      un villageois visiter un autre village (avec une plateforme) et le ramène. Le village garde au
      plus 2 véhicules.</li>
      <li><b>Les lampadaires</b> : les maçons plantent des poteaux surmontés d'une torche le long
      des routes, pour éclairer le village la nuit.</li>
      <li><b>La grange</b> (dès 3 maisons) : les maçons bâtissent de jour un grand bâtiment en bois,
      plein de coffres le long des murs. Le <b>forestier</b> retire alors les jeunes pousses
      sauvages autour du village et les range à la grange.</li>
      <li><b>Les boutiques</b> (dès 5 maisons) : une boulangerie, puis une boucherie. Ce sont des
      immeubles de trois étages : la boutique au rez-de-chaussée, sans accès aux étages comme une
      vraie boutique, et à côté une porte qui mène à l'escalier et aux deux étages de logements.
      Le <b>boulanger</b> fait du pain avec le blé de la mairie ; le <b>boucher</b> tient sa
      boutique. On peut commercer avec eux.</li>
      <li><b>Les gardes</b> (un pour 6 habitants environ) : ils dorment le jour et veillent la nuit.
      Ils font des rondes dans le village et courent frapper les zombies qui s'approchent ; ils ne
      s'enfuient pas. S'il y a un véhicule libre à la plateforme, un garde décolle avec : il tourne
      au-dessus du village toute la nuit, tire sur les zombies en dessous et le ramène au matin.</li>
      <li><b>Le mur d'enceinte</b> (dès 4 maisons, s'il y a de la pierre) : les maçons entourent le
      village d'un mur de pierre de 2 blocs, tronçon par tronçon, avec des torches et une porte au
      milieu de chaque côté et sur chaque route. L'après-midi, ils s'y mettent avant tout le reste
      pour être prêts à la nuit. Quand il n'y a plus de place à l'intérieur, ils bâtissent un mur
      plus grand, puis démontent l'ancien.</li>
      <li><b>Les naissances</b> : avec de la nourriture (potager, pêche) et un lit libre, un enfant
      naît ; il grandit en 20 minutes et prend un métier à son tour. Les enfants vont à l'école le jour.</li>
      <li><b>Les grands immeubles</b> (dès 20 maisons, à partir du jour 5) : un hall au rez-de-chaussée,
      puis 4 à 7 étages de 2 appartements de 2 lits, autour d'un escalier en colimaçon.</li>
      <li><b>Le cantonnier</b> (dès 4 maisons, quand des portes ne sont pas reliées) : il trace les
      chemins de gravier des portes jusqu'à la route (maisons, grange, pépinière, école, hôpital,
      poste) ; les maçons s'occupent alors du reste.</li>
      <li><b>La route de bitume</b> (quand deux villages à moins de 700 blocs ont chacun leur
      plateforme de lancement) : le cantonnier de chaque village la construit depuis son bout,
      3 cases de large, en douce pente (on remblaie, on creuse, un pont de pierre sur l'eau). Finie, le
      mécanicien assemble une <b>voiture</b> (4 roues, une caisse, un pilote de route) au garage, au
      départ de la route, et le chauffeur y emmène des visiteurs chez le voisin, puis les ramène.</li>
      <li><b>La poste</b> (dès 8 maisons) : les <b>livreurs</b> y dorment la nuit ; le jour, ils portent
      les ressources d'un bâtiment à l'autre : la pierre et les minerais des coffres de la mine à
      la mairie, le blé à la boulangerie, le bois de la grange à la mairie quand un chantier en
      attend (et le surplus à la grange), les minerais aux artisans.</li>
      <li><b>L'hôpital</b> (dès 12 maisons) : un villageois blessé va s'y allonger ; le <b>médecin</b>
      le soigne bien plus vite. Parle au médecin pour te faire soigner (en survie, 2 lingots de fer).</li>
      <li><b>L'école</b> (dès 15 maisons) : une grande salle avec un tableau et des pupitres ;
      l'<b>instituteur</b> fait la classe aux enfants du village.</li>
      <li><b>La mine</b> : au fond du puits, les mineurs creusent de grandes salles (4 blocs de haut),
      les unes après les autres, et rangent la pierre et les minerais dans les coffres de la mine
      (les livreurs les apportent à la mairie).</li>
      <li>Tu peux <b>aider</b> le village en déposant du bois ou de la pierre taillée dans le coffre
      de la mairie... ou t'y servir.</li>
      <li><b>Offrir un cadeau</b> : accroupi, l'objet en main, clic droit sur un villageois. Toute
      la pile va au coffre de la mairie et tout le village l'apprend : de quoi se faire pardonner
      (même un villageois qui a peur de toi t'attend si tu t'approches accroupi, un objet en main).</li>
    </ul>
    <h3>Œufs d'apparition</h3>
    <p>Un œuf par animal (cochon, moutons, vache, renard, lièvre, villageois, zombie), dans l'inventaire du
    créatif : clic droit sur un bloc, l'animal apparaît dessus.</p>
    <h3>Herbe haute</h3>
    <p>Pousse d'elle-même sur l'herbe, peu à peu. Elle se casse d'un coup et ne donne rien.</p>
    <h3>Manger</h3>
    <p>En survie, nourriture en main, clic droit quand il te manque de la vie :</p>
    <ul>
      <li>Côtelette crue : 1 cœur.</li>
      <li>Côtelette cuite (au four, avec du combustible) : 4 cœurs.</li>
    </ul>
    <h3>Cultures</h3>
    <p>Laboure la terre ou l'herbe avec une houe (clic droit), puis sème-y des graines de blé ou
    plante une pomme de terre, une carotte ou une tomate (clic droit sur le dessus de la terre
    labourée). Elles poussent toutes seules. Le blé mûr donne du blé et 1 à 3 graines (3 blés font
    un pain) ; les pommes de terre mûres en donnent 2 à 4, à manger crues ou cuites au four ; les
    carottes mûres, 2 à 4 carottes ; le plant de tomates, une fois ses tomates rouges, 2 à 3 tomates.</p>
    <h3>Sandwichs</h3>
    <p>Dans la grille d'artisanat, l'un sur l'autre : une <b>tomate</b>, une <b>viande</b> et du
    <b>pain</b>. Avec une viande cuite, le sandwich est prêt (il nourrit plus que ses ingrédients) ;
    avec une viande crue, c'est un sandwich cru, à passer au four. Au porc, au mouton, au renard
    ou à l'alien.</p>
    <p>Dans les villages, les fermiers cultivent
    les champs : du blé et des pommes de terre, une case sur deux ; la récolte va au boulanger
    (ou au coffre de la mairie) et nourrit le village.</p>`],
  ['robots', 'Robots', `
    <p>Un robot est un aide que tu fabriques et que tu règles. Pose-le comme un œuf (clic droit sur le sol),
    puis <b>clic droit sur lui</b> : sa fenêtre de réglage s'ouvre.</p>
    <h3>Fabrication</h3>
    <ul>
      <li><b>Robot</b> : acier, circuit, voltite et une batterie de stockage.</li>
      <li><b>Station de recharge pour robots</b> : acier, circuit, câbles et une batterie de stockage. Elle se branche
      au réseau électrique comme une machine (200 W quand un robot se recharge).</li>
    </ul>
    <h3>Métiers</h3>
    <ul>
      <li><b>Éleveur</b> : il nourrit les animaux de sa zone pour qu'ils fassent des petits, jusqu'au nombre voulu par
      espèce (la nourriture est prise dans son coffre). Coche « Abattre le surplus » : il abat les adultes en trop,
      la viande et la laine vont au coffre.</li>
      <li><b>Bûcheron</b> : il coupe les arbres de sa zone, replante une pousse et range le bois.</li>
      <li><b>Fermier</b> : il récolte les cultures mûres, les ressème, et sème la terre labourée vide (graines, pommes
      de terre, carottes, tomates prises dans son coffre).</li>
      <li><b>Mineur</b> : il creuse sa zone de haut en bas jusqu'à la profondeur voulue (8 cases de rayon au plus) et
      range ce qu'il trouve. Il ne touche ni aux coffres, ni aux machines, ni aux liquides.</li>
      <li><b>Transporteur</b> : il vide le coffre de départ dans le coffre d'arrivée.</li>
      <li><b>Bâtisseur</b> : il construit les <b>projections de schématique</b> posées dans sa zone avec les blocs de
      son coffre (en créatif, sans rien prendre). De quoi faire bâtir une maison, une usine… ou un moteur planétaire.</li>
      <li><b>Suivre</b> : il te suit (loin, il te rejoint d'un bond). <b>En attente</b> : il ne bouge plus.</li>
    </ul>
    <h3>Zone et coffre</h3>
    <p>Chaque robot travaille dans une zone : un rayon (2 à 24 cases) autour d'un centre (toi, ou lui). « Lier un coffre »,
    puis clic droit sur un coffre : c'est là qu'il range et qu'il prend ce dont il a besoin. Quand ses poches sont pleines
    (64 objets), il va les vider. Là où il ne peut pas aller à pied (le fond d'un trou, le haut d'une construction), ses
    petits propulseurs le portent.</p>
    <h3>Batterie</h3>
    <p>En survie, sa batterie se vide en une demi-heure de travail (voler use deux fois plus). En dessous de 15 %, il part
    tout seul à la station de recharge la plus proche (64 blocs au plus) ; elle le recharge en 40 secondes si le réseau
    a assez de courant. En créatif, sa batterie ne s'use pas.</p>
    <p>« Ramasser le robot » le remet dans ton inventaire, avec ce qu'il porte. En multijoueur, c'est l'hôte de la partie
    qui règle les robots.</p>`],
  ['meteo', 'Météo', `
    <p>Le temps dépend de l'endroit : de grandes perturbations traversent le monde avec le vent.
    Il peut pleuvoir chez un joueur et faire beau chez un autre plus loin.</p>
    <ul>
      <li><b>Pluie</b> sous les nuages (pas sous un toit), <b>neige</b> là où il fait froid. Les
      déserts sont plus secs.</li>
      <li><b>Orages</b> : ciel sombre, éclairs et tonnerre, surtout l'après-midi.</li>
      <li><b>Tempêtes</b> : rafales de vent, grosses vagues en mer.</li>
      <li><b>Tornades</b> : parfois, dans les orages les plus forts. Elles aspirent et projettent
      le joueur et les objets physiques.</li>
      <li>Les nuages sont plus ou moins gris selon le temps qu'il fait dessous.</li>
      <li><b>Tempêtes de sable</b> : dans le désert et la mesa, là où il pleuvrait ailleurs, le vent
      soulève le sable ; on n'y voit plus qu'à quelques dizaines de blocs.</li>
      <li><b>Cendres</b> : près des volcans et des caldeiras, des cendres tombent sans cesse (plus fort
      quand il pleut), le ciel est gris.</li>
      <li><b>Pluie diluvienne</b> : les plus fortes pluies d'orage, et presque toute la pluie de la jungle
      toxique : deux fois plus de gouttes, le ciel très sombre.</li>
      <li><b>Pluie d'astéroïdes</b> : certaines nuits, des étoiles filantes partout dans le ciel. De
      temps en temps, un météore tombe au loin et creuse un petit cratère de pierre de cratère, avec au
      fond un minerai rare venu de l'espace (iridium, gravitite, titane ou uranite). Il ne tombe jamais
      sur ce qui a été construit.</li>
    </ul>
    <h3>Changer la météo</h3>
    <ul>
      <li><code>/weather 1</code> à <code>/weather 5</code> : une dépression (nuages, pluie, orages)
      se forme en moins d'une minute à cet endroit et dérive avec le vent (environ 15 minutes).</li>
      <li><code>/weather -1</code> à <code>/weather -5</code> : un anticyclone (beau temps).</li>
      <li><code>/weather tornade</code> : tempête en quelques secondes, et une tornade qui arrive.</li>
      <li><code>/weather asteroides</code> : une pluie d'astéroïdes la nuit (à nouveau : l'arrête).</li>
      <li><code>/weather</code> : le temps qu'il fait ici. <code>/weather reset</code> : retour au temps naturel.</li>
    </ul>
    <p>Carte du monde : la case « Météo (pluie) » montre la pluie, les orages et les tornades
    comme un radar.</p>`],
  ['saisons', 'Saisons', `
    <p>L'année dure 84 jours : printemps, été, automne et hiver, 21 jours chacun. Un nouveau monde
    commence au printemps.</p>
    <ul>
      <li><b>Printemps</b> : feuillage vert tendre, arbres en fleurs, l'herbe repousse.</li>
      <li><b>Été</b> : chaud, plus d'orages ; l'herbe sèche dans les régions chaudes.</li>
      <li><b>Automne</b> : plus de pluie ; les feuillus (chêne, châtaignier, tilleul, bouleau, érable, noyer, ginkgo,
      liquidambar, bouleau alien) jaunissent puis
      rougissent, leurs feuilles tombent. Les conifères et les oliviers restent verts.</li>
      <li><b>Hiver</b> : arbres nus, herbe en dormance. Là où il gèle, la neige tombe en couches qui s'empilent (jusqu'à 4 d'elle-même) sur le dessus des blocs, des dalles et des dalles verticales, jamais sous un toit, puis fond au redoux.</li>
      <li>Couche de neige : 3 blocs de neige en donnent 6. Clic droit sur une couche avec une couche en main : une de plus (8 au plus). On s'y enfonce ; une pelle récupère une boule de neige par couche.</li>
    </ul>
    <p>La température dépend du lieu : les régions froides et les montagnes le sont davantage (la neige y
    arrive plus tôt), la mer adoucit les côtes, et le désert ou le volcan n'ont pas de saisons.
    Le soleil monte plus haut en été. Les plantes poussent moins vite quand il fait froid et ne
    poussent presque plus en hiver.</p>
    <p><code>/saison</code> : la saison et la température ici. L'hôte peut passer à la suivante
    avec <code>/saison printemps</code>, <code>été</code>, <code>automne</code> ou
    <code>hiver</code>. F3 affiche aussi la saison.</p>`],
  ['monde', 'Le monde', `
    <ul>
      <li>Un jour dure 30 minutes. La lune a 8 phases.</li>
      <li>Le monde est généré à partir de la <b>graine</b> : la même graine donne le même monde.</li>
      <li>On peut construire de la couche 0 (la roche du fond) à la couche 155. La mer est au
      niveau 64, les plus hautes montagnes dépassent 140.</li>
      <li><b>Mondes d'avant la version 0.8.6</b> : les endroits déjà visités ne changent pas et
      restent à leur ancienne hauteur (mer au niveau 24), comme tout ce qui est à moins de
      560 blocs d'eux. Plus loin, le monde est plus haut : les anciens endroits se retrouvent au
      fond d'une immense cuvette, entourée d'un anneau de montagnes enneigées.</li>
      <li>Continents séparés par des océans, montagnes, volcans, déserts, plaines enneigées,
      grandes forêts aux chênes géants, forêts européennes de chênes, de châtaigniers et de
      tilleuls…</li>
      <li><b>Pousses d'arbre</b> : plantées, elles deviennent des arbres. 4 pousses de chêne
      donnent une pousse de grand chêne.</li>
      <li>Les nouveaux biomes (dans les endroits encore jamais explorés) :
        <ul>
          <li><b>Mesa</b> : une partie des déserts. Sable rouge et buttes en gradins de terre cuite
          rouge, orange et jaune, en couches.</li>
          <li><b>Jungle toxique</b> : les forêts chaudes et humides. Arbres toxiques serrés, mousse,
          pierre toxique, flaques de sève qui luit. La boue et la sève toxiques blessent (un demi-cœur
          par seconde). Il y pleut à verse.</li>
          <li><b>Champignons géants</b> : ce biome n'existe plus sur Hexa. Il ne reste que les forêts de champignons
          (8 à 13 blocs de haut, certains lumineux) des endroits déjà visités avant sa disparition.</li>
          <li><b>Caldeira</b> : un volcan sur deux s'est effondré : un grand cratère plat, un lac de
          lave au milieu, des arbres calcinés, de la cendre.</li>
          <li><b>Montagnes flottantes</b> : au-dessus de certaines plaines, des îles de pierre
          flottante dans le ciel (il faut construire pour y monter). Il n'y en a plus dans les
          endroits explorés depuis l'arrivée des nouveaux bois (seulement près des endroits déjà visités).</li>
          <li><b>Cavernes de glace</b> (sous les régions froides, de -25 à -65) et <b>grottes
          luxuriantes</b> (sous les forêts, la jungle et les champignons) : de grandes cavernes,
          avec un lac au fond.</li>
          <li><b>L'Abysse</b> : au fond de l'abîme, la pierre abyssale, des blocs eldritch qui luisent
          dans les parois, du sable irradié au fond des cavernes.</li>
        </ul>
      </li>
      <li>Les biomes des nouveaux bois (dans les endroits encore jamais explorés) :
        <ul>
          <li><b>Forêt d'érables rouges</b> (tempérée) : érables à la couronne ronde et rouge, des
          plaques de feuilles tombées.</li>
          <li><b>Noyeraie sombre</b> (tempérée chaude) : noyers trapus à la couronne large et
          plate, de la mousse sous leur ombre.</li>
          <li><b>Forêt de bouleaux aliens</b> (fraîche) : de grands bouleaux pâles au feuillage en
          plateaux étagés.</li>
          <li><b>Bois de bouleaux géants</b> (régions froides) : des bouleaux aliens de 15 à 20 blocs,
          clairsemés.</li>
          <li><b>Oliveraie</b> (collines chaudes et sèches) : oliviers bas et tordus, herbe sèche.</li>
          <li><b>Savane d'oliviers</b> (plaines chaudes et sèches, entre déserts et plaines) : herbe
          jaunie et haute, oliviers isolés.</li>
          <li><b>Bosquet de ginkgos dorés</b> (doux) : ginkgos hauts et étroits, au feuillage doré.</li>
          <li><b>Marais de liquidambars</b> (humide) : boue, mousse, mares, liquidambars en pyramide.</li>
          <li><b>Forêt d'automne</b> : érables, noyers et chênes mêlés sur un tapis de feuilles rouges
          et orange.</li>
          <li><b>Forêt-galerie</b> : ginkgos et liquidambars serrés le long de certaines rivières.</li>
        </ul>
        Chaque bois donne ses bûches, planches, bâtons et outils (comme le bois de chêne) ; ses feuilles
        donnent parfois sa pousse, qui devient le même arbre.
      </li>
      <li>On entend les oiseaux le jour et les grillons la nuit dans les plaines et les forêts, et
      le feu des torches de près.</li>
    </ul>`],
  ['traveler', 'Le Traveler-98', `
    <p>Il y a 241 ans, le vaisseau d'exploration <b>Traveler-98</b> s'est écrasé quelque part dans
    le monde, à plus de 7500 blocs du point de départ, loin de tout village. Son épave, couverte
    de mousse, garde encore ses cinq compartiments : commandes, laboratoire, infirmerie, atelier
    et réacteur, et un sas sur le flanc.</p>
    <ul>
      <li>Ses coffres contiennent des <b>planchettes futuristes</b> : clic droit pour lire leur fiche
      (molette : faire défiler). Certaines sont <b>corrompues</b> et illisibles.</li>
      <li>Seulement dans les endroits jamais visités : un monde déjà exploré à cet endroit n'aura
      pas d'épave.</li>
    </ul>
    <h3>Nédrolytium</h3>
    <p><i>Matériau composite énergétique extrêmement rare.</i> Alliage de tungstène (30 %),
    platine (25 %), fluorite (20 %), cramoisite (15 %) et voltite (10 %). Bleu nuit à reflets
    violets, veines rougeâtres lumineuses, surface métallique hexagonale. Il ne produit pas
    d'énergie : il convertit une énergie stockée en propulsion. On en trouve dans le réacteur
    de l'épave.</p>`],
  ['fin', 'Le signal (la fin du jeu)', `
    <p>Une fois les six tiers technologiques terminés, il en reste un : <b>le signal</b>. L'équipage du
    Traveler-98 n'a jamais pu prévenir la Terre ; son antenne est encore dans l'épave.</p>
    <ul>
      <li><b>Balise interstellaire</b> : 2 lingots de nédrolytium, un émetteur radio, 2 ordinateurs de bord, un bloc de
      nédrolytium, un réacteur et 3 aciers sombres, sur l'établi.</li>
      <li>Pose-la dans l'épave du Traveler-98 et alimente-la : 250 W pendant 45 secondes. Vise-la pour suivre sa charge.</li>
      <li>Le message part, puis viennent les crédits. Le monde continue ensuite : ta partie n'est pas finie.</li>
    </ul>`],
  ['carburant', 'Carburant et nédrolytium', `
    <p>Les fusées brûlent du <b>carburant primaire</b>, un liquide fabriqué à l'usine. Les liquides
    circulent dans des <b>réseaux</b> : les tuyaux et les réservoirs qui se touchent (les 6 côtés,
    dessus, dessous) partagent leur contenu. Un réseau ne porte qu'un liquide à la fois : il faut
    une ligne pour l'eau et une autre pour le carburant.</p>
    <ul>
      <li><b>Tuyau</b> : relie les blocs de liquide (100 mB chacun).</li>
      <li><b>Réservoir industriel</b> : 16 000 mB. Vise-le pour lire le niveau du réseau.</li>
      <li><b>Pompe à eau</b> (10 W) : posée contre de l'eau (deux cases ou plus pour pomper à fond,
      250 mB par seconde), elle remplit le réseau d'eau qui la touche.</li>
      <li><b>Raffinerie</b> (40 W) : elle touche deux réseaux, un d'eau et un autre (vide ou de
      carburant). Dans son coffre : <b>2 charbons + 1 soufre</b>. Avec 1 000 mB d'eau, en 6 s, elle
      verse <b>500 mB de carburant primaire</b>.</li>
      <li><b>Bidon</b> : clic droit avec un bidon vide sur un tuyau ou un réservoir de carburant pour
      le remplir (1 000 mB), avec un bidon plein pour le vider. Le <b>bidon créatif</b> (inventaire
      créatif) remplit d'un coup le réservoir visé et ne se vide jamais.</li>
      <li><b>Cuve de carburant primaire</b> (4 bidons pleins) : du carburant en bloc. Elle explose
      au contact de la lave, du magma, d'une chaudière ou d'un haut fourneau allumés, d'une torche
      ou d'une autre explosion.</li>
    </ul>
    <h3>Nédrolytium</h3>
    <p>Le <b>creuset à nédrolytium</b> (60 W) fond le mélange de la fiche du Traveler-98, posé dans
    son coffre : <b>6 poussières de tungstène, 5 de platine, 4 de fluorite, 3 de cramoisite et
    2 voltites</b> (les poussières sortent du concasseur). En 12 s : un <b>lingot de nédrolytium</b>.
    9 lingots font un bloc de nédrolytium, le cœur du réacteur des fusées.</p>`],
  ['liquides', 'Liquides et machines', `
    <p>Au-delà de l'eau et du carburant primaire, l'usine traite d'autres liquides. Chaque machine à
    liquides prend dans les <b>réseaux qui la touchent</b> (un réseau par liquide) et verse dans
    d'autres : il faut un réseau vide, ou du même liquide, pour chaque produit. Les objets d'une
    recette se mettent dans son coffre (clic droit). Vise une machine pour savoir ce qui lui manque.</p>
    <ul>
      <li><b>Tuyau renforcé</b> : 1 000 mB (le tuyau de cuivre : 100). <b>Réservoir en cuivre</b> :
      32 000 mB ; <b>réservoir renforcé</b> : 64 000 mB.</li>
      <li><b>Puits de pétrole</b> (20 W) : du <b>pétrole brut</b> (60 mB/s), seulement dans les
      déserts, la mesa, la jungle toxique et en mer.</li>
      <li><b>Condenseur</b> (30 W) : 1 000 mB de pétrole brut → 600 de <b>pétrole léger</b> + 400 de
      <b>pétrole lourd</b>.</li>
      <li><b>Chambre de réaction</b> (50 W) : léger → <b>essence</b> ; lourd → <b>gazole</b> ;
      hydrogène liquide + une glace d'azote → <b>hydrazine</b>.</li>
      <li><b>Mélangeur</b> (20 W) : eau + soufre (ou 2 sels) → <b>électrolyte</b> ; hydrogène liquide
      + 2 poussières de fluorite → <b>fluorium</b>.</li>
      <li><b>Électrolyseur</b> (80 W) : 1 000 mB d'eau + 50 d'électrolyte → 500 d'<b>oxygène
      liquide</b> + 500 d'<b>hydrogène liquide</b>.</li>
      <li><b>Four complexe</b> (30 W) : lave + un lingot de fer (ou 2 ferrailles rouillées) →
      <b>métal en fusion</b>. <b>Presse hydraulique</b> (25 W) : 500 mB de métal en fusion → un
      <b>acier</b>. <b>Refroidisseur</b> (15 W) : lave + eau → de l'<b>obsidienne</b>.</li>
      <li>La <b>pompe</b> pompe aussi la <b>lave</b> quand elle n'a que de la lave autour (plus lentement).</li>
      <li><b>Groupe électrogène</b> : 120 W, en brûlant l'essence (8 mB/s) ou le gazole (6 mB/s) d'un
      réseau qui le touche.</li>
      <li><b>Bidons</b> : un bidon vide se remplit sur n'importe quel réseau (1 000 mB) et devient un
      bidon de ce liquide ; plein, il se vide sur un réseau vide ou du même liquide.</li>
    </ul>
    <h3>Dans une fusée</h3>
    <p>Les réservoirs de fusée prennent le carburant primaire et aussi d'autres liquides, qui valent
    plus ou moins : <b>fluorium ×2</b>, <b>hydrazine ×1,6</b>, <b>hydrogène liquide ×1,3</b>,
    essence ×0,6, gazole ×0,5 (un bidon de fluorium donne 2 000 mB de carburant). Les autres ne
    brûlent pas. Un port d'amarrage fait le plein avec n'importe lequel de ces liquides.</p>`],
  ['armes', 'Armes et boucliers', `
    <h3>Armes à main</h3>
    <p>Tiens l'arme : <b>clic gauche</b> pour tirer, <b>clic droit</b> (maintenu) pour viser. En survie,
    les munitions viennent de l'inventaire (en bas à droite : ce qu'il en reste). Chaque tir fait remonter
    un peu le canon (moins en visant).</p>
    <ul>
      <li><b>Pistolet</b> : un tir par clic. <b>Fusil</b> : en rafale, clic maintenu. Munitions : balles, ou
      <b>balles en uranium appauvri</b> (prises d'abord) : presque deux fois plus fortes, elles traversent
      deux cibles.</li>
      <li><b>Railgun</b> : un rayon instantané, qui traverse tous les êtres jusqu'au premier bloc. Tiges de railgun.</li>
      <li><b>Arme à énergie</b> : des éclairs, en rafale. Une cellule d'énergie fait 12 tirs.</li>
      <li><b>Lance-flammes</b> : il brûle les bidons d'essence (le bidon vide revient), allume la TNT.</li>
    </ul>
    <h3>Armes en blocs (engins)</h3>
    <p>Pose-les sur un objet collé (Super colle) avec un <b>poste de pilotage</b> : assis aux commandes,
    <b>clic gauche</b> (maintenu) et toutes les armes de l'engin tirent vers ce que tu vises. Leurs munitions
    sont dans les <b>chambres de chargement</b> de l'engin (un coffre : mets-y les munitions). En créatif,
    elles ne s'épuisent pas.</p>
    <ul>
      <li><b>Canon automatique</b> : balles en rafale.</li>
      <li><b>Lance-roquettes</b> : roquettes droit devant, qui explosent.</li>
      <li><b>Lance-missiles</b> : le missile part vers la cible la plus proche de ce que tu vises (un animal,
      un engin, un joueur) et la suit.</li>
      <li><b>Lance-torpilles</b> : la torpille file sous l'eau (dans l'air, elle tombe) ; elle casse les blocs
      même sous l'eau.</li>
      <li><b>Canon à bobine</b> : une tige à très grande vitesse qui perce jusqu'à 4 blocs. Il prend 25 de
      charge aux <b>accumulateurs électriques</b> de l'engin (100 chacun, ils se rechargent seuls).</li>
      <li><b>Canon d'artillerie</b> : des obus (ceux du wagon blindé), en cloche.</li>
      <li><b>Canon Gustave</b> : des obus lourds, une très grosse explosion (et un fort recul). Avec une
      <b>charge nucléaire</b> dans une chambre de chargement, il tire celle-ci d'abord : une explosion
      énorme. À la création du monde, on peut <b>interdire les charges nucléaires</b>.</li>
    </ul>
    <h3>Tourelles et équipes</h3>
    <p>Une tourelle est un seul bloc : elle vise et tire <b>toute seule</b> sur ce qui appartient à une
    autre équipe (les engins, et les joueurs qui ont choisi une équipe avec <b>/equipe</b>). Pose-la sur un
    objet collé (voiture, fusée) ou dans le monde. Avec la <b>clé à molette</b> sur une tourelle, on change
    d'équipe : Rouge, Bleue, Verte, Jaune, ou aucune (la tourelle ne tire plus). Sur un engin, l'équipe est
    celle de tout l'engin. Ses tirs abîment les engins ennemis, bloc par bloc.</p>
    <ul>
      <li><b>Tourelle à balles</b> : des rafales rapides, à 90 blocs. Balles des chambres de chargement de
      l'engin (dans le monde : d'un coffre ou d'une chambre qui la touche).</li>
      <li><b>Tourelle lance-missiles</b> : des missiles qui suivent leur cible, jusqu'à 220 blocs.</li>
      <li><b>Tourelle laser</b> : un rayon instantané, à 160 blocs. Il prend la charge des accumulateurs de
      l'engin ; dans le monde, il lui faut du courant.</li>
    </ul>
    <p>En créatif, les tourelles ne manquent jamais de munitions : de quoi lancer une fausse guerre entre
    deux flottes et regarder le spectacle. Les engins peuvent aussi se battre seuls (ordinateur de bord,
    pilote de route : chasser, fuir, garder).</p>
    <h3>Boucliers</h3>
    <ul>
      <li><b>Émetteur de bouclier</b> : sur un engin, une bulle autour de lui arrête les tirs qui arrivent,
      tant que ses accumulateurs ont de la charge (chaque tir arrêté en prend). Posé dans le monde et
      alimenté (levier, fil...), une bulle de 9 blocs autour de lui.</li>
      <li><b>Déflecteur</b> : il abat les roquettes, missiles, torpilles et obus qui approchent (un par
      seconde, à 18 blocs). Sur un engin, il prend un peu de charge ; dans le monde, il faut du courant.</li>
      <li><b>Projecteur de bouclier thermique</b> : l'engin ne craint plus le feu ni les armes à énergie ; à
      grande vitesse, un bouclier orange se forme devant lui.</li>
      <li><b>Générateur de bouclier stellaire</b> : tout près de lui, les explosions ne cassent plus aucun
      bloc (sur l'engin, ou dans le monde à 24 blocs s'il est alimenté).</li>
    </ul>`],
  ['rebellion', 'Rébellion des villageois', `
    <p>Les villageois se souviennent de tout (voir <i>Villages</i>). Un village <b>assez avancé</b> —
    au moins 4 adultes, et une plateforme de véhicules, un mur d'enceinte ou 6 maisons — qui te déteste
    trop longtemps finit par se <b>rebeller</b>.</p>
    <h3>Ce qui les met en colère</h3>
    <ul>
      <li>Frapper ou tuer un villageois (surtout devant témoins).</li>
      <li>Casser des blocs dans le village, fouiller ses coffres, faire exploser quelque chose tout près.</li>
    </ul>
    <p>Commercer et offrir des cadeaux (accroupi + clic droit) les apaise. Les messages du chat te
    préviennent : d'abord des <b>murmures</b>, puis le village <b>gronde</b>. Au bout d'une heure de
    jeu de haine, il <b>complote</b> : plus personne ne commerce avec toi, et une fusée se construit
    en secret au bord du village. Fais-toi pardonner à temps et le complot tombe à l'eau.</p>
    <h3>En créatif : un dieu</h3>
    <p>En créatif, les villageois te voient comme un <b>dieu</b>. Ta présence, tes vols et tes
    « miracles » (des blocs posés dans leur village) font monter leur <b>ferveur</b>. Un culte naît...
    puis une <b>croisade</b> : ils partent conquérir ton royaume.</p>
    <h3>Les raids sur les villages fidèles</h3>
    <p>Une faction cachée assez avancée fait la <b>guerre aux villages qui te sont restés fidèles</b> :
    toutes les trois heures de jeu, un vaisseau habitat se pose dans un village près de toi et ses
    soldats attaquent les villageois. Les gardes se défendent ; aide-les ! Si la moitié des adultes
    tombent, le village est <b>pillé</b> et t'en veut ; s'il tient bon avec ton aide, il te remercie.</p>
    <h3>Les prisonniers</h3>
    <p>Un soldat rebelle à bout de forces peut <b>se rendre</b> (une fois sur deux) : il devient
    prisonnier et te suit. Mène-le dans un <b>village fidèle</b> : interrogé, il avoue où se cachent
    les colonies de sa faction (des repères s'ajoutent), et les villageois le gardent en prison.</p>
    <h3>Les espions</h3>
    <p>Une faction cachée assez avancée plante un <b>espion</b> dans un village qui t'est encore fidèle.
    Il ressemble à tous les autres, mais toutes les heure et demie de jeu, il <b>émet</b> : un « signal
    suspect » est capté, et pendant vingt secondes des <b>étincelles</b> brillent au-dessus de sa tête.
    Chaque émission monte le village contre toi et ajoute un chasseur à la prochaine attaque. Frappe le
    bon villageois pour le <b>démasquer</b> : il s'enfuit, le village te remercie et la faction perd
    ses renseignements. Mais frapper un innocent fâche le village...</p>
    <h3>Le tribut</h3>
    <p>Au puits du village abandonné, les rebelles ont laissé un <b>coffre</b>. Ce que tu y déposes en
    <b>lingots de fer</b> (la voltite en vaut trois) est emporté : avec 32 lingots, tu obtiens une
    <b>trêve</b> (la flotte en cours d'attaque se retire et la suivante est repoussée), mais chaque
    trêve coûte plus cher que la précédente. Avec 160 lingots en tout, c'est la <b>paix</b> pour de
    bon. En créatif, ce sont des offrandes au Dieu.</p>
    <h3>Les pionniers : un départ en ami</h3>
    <p>À l'inverse, un village qui t'<b>adore</b> (beaucoup de commerce, de cadeaux) pendant deux heures
    de jeu rêve des étoiles : une fois, il envoie la <b>moitié de ses adultes</b> fonder une colonie sur
    une autre planète. Ils te disent où ils vont (un repère), et le village reste. Leur colonie est
    <b>alliée</b> : les colons commercent avec toi, ses tourelles la défendent, et un coffre t'y attend.
    Pendant une attaque rebelle, les pionniers t'envoient leurs <b>chasseurs en renfort</b>. Mais si tu
    casses leur chargeur de chunks, ils se sentent trahis... et deviennent une rébellion.</p>
    <h3>L'exode</h3>
    <p>Partir demande une <b>fusée</b>, et seul un vrai village peut la bâtir : au moins <b>7 maisons et 40 habitants</b> (pour les pionniers aussi). Un village plus petit garde sa colère (ou son adoration) et attend d'avoir grandi. De nuit, ou quand tu es loin, tout le village monte dans la fusée et quitte Hexa. Il se cache
    sur une planète d'un <b>autre système solaire</b>. Va voir le puits du village abandonné : ils y
    ont gravé où ils sont partis (un repère est ajouté).</p>
    <h3>La faction rebelle</h3>
    <p>Cachée, elle grandit même quand personne n'y est. Des <b>transmissions interceptées</b> te
    racontent ses progrès : le <b>chargeur de chunks</b> (ses colonies vivent sans personne), d'autres
    colonies sur d'autres astres, puis un <b>chantier naval</b>.</p>
    <p>Une colonie que tu approches (à 200 blocs) apparaît : maisons d'acier, tourelles, gardes
    rebelles qui tirent au laser, un chasseur posé qui décolle. Au centre, le <b>chargeur de chunks
    rebelle</b> (rouge et noir) : casse-le et la colonie tombe.</p>
    <h3>L'attaque</h3>
    <p>Quelques heures de jeu après l'exode (8 par défaut, une heure de jeu = 75 secondes), la flotte
    attaque là où tu es. Un bandeau rouge suit la bataille.</p>
    <ul>
      <li><b>Chasseur</b> : petit et rapide, il tourne autour de toi et tire. Si tu t'enfuis en vaisseau,
      les chasseurs te poursuivent dans l'espace, même en saut (ils accélèrent plus fort que toi). Dans l'espace, ton <b>radar</b> montre chaque vaisseau rebelle (en rouge) ou pionnier (en bleu) avec sa distance, même derrière toi : son repère se colle alors au bord de l'écran.</li>
      <li><b>Vaisseau habitat</b> : chambres, vivres, oxygène et des soldats à bord ; il se pose près de
      toi et ils débarquent.</li>
      <li><b>Cargo</b> : il porte trois chasseurs sur son pont et les largue au-dessus de toi.</li>
      <li><b>Croiseur</b> : énorme. Deux hangars de chasseurs (abîmés, ils y reviennent s'amarrer pour
      être réparés), deux vaisseaux habitats amarrés sur ses flancs, des tourelles partout, un bouclier.
      Détruis son poste de pilotage, ses réacteurs ou une bonne part de sa coque : la vague est finie,
      et ses coffres sont pleins de butin.</li>
    </ul>
    <p>Toutes les armes abîment les vaisseaux rebelles, même celles qu'on tient à la main. Les
    tourelles d'une équipe (voir <i>Armes et boucliers</i>) les prennent pour cible.</p>
    <h3>La fin</h3>
    <ul>
      <li>Plus aucune colonie (tous les chargeurs de chunks détruits) : la rébellion est <b>écrasée</b>.</li>
      <li>Trois vagues repoussées : ils demandent une <b>trêve</b>.</li>
      <li>Si tu meurs pendant l'attaque, ils se retirent... et reviendront.</li>
    </ul>
    <p><kbd>/rebellion</kbd> : l'humeur des villages et l'état des factions (où elles sont, leur flotte,
    l'heure de l'attaque). <kbd>/rebellion off</kbd> : plus de rébellion dans ce monde ;
    <kbd>/rebellion delai 4</kbd> : l'attaque 4 heures de jeu après l'exode.</p>
  `],
  ['etancheite', 'Étanchéité et portes', `
    <p>Une pièce garde son air (générateur d'oxygène) tant qu'elle est fermée. Les portes laissent
    passer les joueurs <b>sans percer la pièce</b>. Une porte, c'est tous les blocs de la même porte
    qui se touchent : ils s'ouvrent et se ferment ensemble (une grande porte hydraulique de 2 × 3 se
    construit bloc par bloc). Fermée, elle arrête l'air ; ouverte, il n'en reste que le cadre.</p>
    <ul>
      <li><b>Porte étanche</b> : deux blocs de haut, posés d'un coup. Clic droit pour l'ouvrir ou la fermer.</li>
      <li><b>Sas</b> : clic droit, comme la porte étanche ; mais deux portes de sas à moins de 6 blocs ne
      sont <b>jamais ouvertes ensemble</b> : ouvrir l'une ferme l'autre. Fais un petit couloir avec un sas
      de chaque côté : l'air de la station ne s'échappe pas quand on sort.</li>
      <li><b>Porte électrique</b> : elle suit le courant (levier, fil ou bloc de voltite qui touche l'un
      de ses blocs) : ouverte avec, fermée sans.</li>
      <li><b>Porte hydraulique</b> : pareil, pour les grandes portes (jusqu'à 32 blocs).</li>
      <li><b>Porte holographique</b> : avec du courant, un champ qu'on <b>traverse</b>, mais qui
      <b>garde l'air</b>. Sans courant, il ne reste que son cadre, et l'air passe.</li>
      <li><b>Soudure de joint</b> : clic droit sur un bloc qui laisse passer l'air (câble, tuyau, levier,
      vitre fine…) pour qu'il l'arrête ; encore une fois pour retirer la soudure. Dans le monde comme
      sur un vaisseau.</li>
    </ul>
    <p>Sur un vaisseau (objet collé), les portes marchent pareil.</p>`],
  ['mecanique', 'Mécanique', `
    <p>Comme l'hélice, les blocs mécaniques tiennent ce qui est posé dessus et le font bouger autour
    de leur axe (vers le haut du bloc). Ce qui bouge : un <b>objet collé</b> (Super colle) posé sur le
    bloc, par exemple un panneau de porte. Ils suivent le courant et son cran (levier analogique).</p>
    <ul>
      <li><b>Charnière</b> : avec du courant, l'objet pivote d'un quart de tour ; sans, il revient. Pour
      une porte qui s'ouvre en tournant.</li>
      <li><b>Rotor</b> : l'objet tourne sans fin, plus ou moins vite selon le cran (une éolienne, un manège).</li>
      <li><b>Servomoteur</b> : l'objet tourne à un angle précis, de 0° (cran 0) à 180° (cran 15).</li>
      <li><b>Rail de translation</b> : l'objet monte d'autant de blocs que le cran (un ascenseur).</li>
      <li>Ils marchent aussi sur un objet collé (un vaisseau qui porte une tourelle, un bras…).</li>
    </ul>
    <h3>Vaisseaux</h3>
    <ul>
      <li><b>Accentueur inertiel</b> : alimenté, sur un vaisseau, ses moteurs poussent <b>50 % plus fort</b>
      (deux au plus : le double).</li>
      <li><b>Nullifieur inertiel</b> : alimenté, sans gaz ni commande, la rotation s'éteint et la dérive aussi
      (en tous sens dans le vide ; à l'horizontale ailleurs, il ne retient pas contre la gravité).</li>
      <li><b>Train d'atterrissage</b> (et le pied d'atterrissage) : posé au sol, le vaisseau ne rebondit
      pas, ne glisse pas et ne bascule pas.</li>
      <li><b>Port d'amarrage</b> entre deux vaisseaux : approche doucement un port de l'un contre un port de
      l'autre, les deux vaisseaux bien alignés : ils s'amarrent et ne font plus qu'un. Clic droit sur
      l'un des ports : ils se séparent.</li>
    </ul>`],
  ['fusees', 'Fusées', `
    <p>Une fusée se construit <b>en blocs, librement</b>, puis se colle en un objet physique comme
    les autres (sa masse compte : chaque bloc pèse).</p>
    <ul>
      <li><b>Réacteur au nédrolytium</b> : il faut qu'un <b>bloc de nédrolytium</b> le touche, sinon
      il ne fait rien. Un réacteur alimente <b>4 tuyères</b> (les plus proches de l'axe).</li>
      <li><b>Réacteur au nédrolytium renforcé</b> : armé de la même façon (un bloc de nédrolytium qui
      le touche), il alimente <b>8 tuyères</b> et tourne la fusée deux fois mieux. Plus lourd. Son saut monte jusqu'à <b>750 G b/s</b>
      (le réacteur classique : 250 G b/s).</li>
      <li><b>Réacteur au nédrolytium-voltite</b> : il lui faut un bloc de <b>nédrolytium</b> et un bloc
      de <b>voltite</b> qui le touchent. Il alimente <b>12 tuyères</b>, tourne la fusée trois fois mieux,
      et ses tuyères brûlent <b>30 % de carburant en moins</b>. Son saut monte jusqu'à <b>1 année-lumière par seconde</b>.</li>
      <li><b>Tuyère</b> : elle pousse vers le haut de la fusée, au plein gaz 30 mB de carburant par
      seconde. Décentrée, elle fait tourner la fusée.</li>
      <li><b>Réacteur classique</b> : comme une tuyère (il compte dans les 4 d'un réacteur au
      nédrolytium et brûle autant), mais il pousse <b>20 % de plus</b>.</li>
      <li><b>Réacteur chimique</b> : il marche <b>seul</b>, sans réacteur au nédrolytium, mais il
      brûle 50 % de plus qu'une tuyère. Le moteur des premières fusées.</li>
      <li><b>Réacteur plasma</b> (×2,5) et <b>tuyère stellaire</b> (×5) : bien plus de poussée, et une
      consommation à peine plus forte (×1,2 et ×2) ; comme les tuyères, ils comptent dans les 4 d'un
      réacteur au nédrolytium.</li>
      <li><b>Propulseur ionique</b> : il ne brûle <b>rien</b>, mais il lui faut du courant (une source
      de voltite qui le touche, dans la fusée). Il pousse très doucement, et presque seulement
      <b>dans le vide</b> : l'air l'étouffe. Réservoir vide, il pousse encore.</li>
      <li><b>Flotteur</b> : un bloc creux très léger, pour faire flotter un bateau.</li>
      <li><b>Réservoir de fusée</b> : 8 000 mB (<b>avancé</b> : 20 000 mB). On le remplit au <b>bidon</b> (clic droit), ou avant
      de coller la fusée, depuis le réseau de tuyaux qui le touche. Le carburant pèse.</li>
      <li><b>Poste de pilotage</b> : clic droit pour s'y asseoir. <b>Pieds d'atterrissage</b> : pour
      se poser droit.</li>
      <li><b>Siège passager</b> : clic droit pour s'y asseoir, <kbd>Maj</kbd> pour se lever. On
      voyage avec la fusée (jusque dans l'espace) sans rien commander. À plusieurs, <b>un seul
      pilote</b> par fusée : les autres prennent un siège passager.</li>
    </ul>
    <h3>Aux commandes</h3>
    <ul>
      <li><kbd>Z</kbd> / <kbd>S</kbd> : les gaz. <kbd>X</kbd> : tout couper.</li>
      <li>Flèches : pencher la fusée. <kbd>Q</kbd> / <kbd>D</kbd> : la faire tourner.
      <kbd>R</kbd> : verticale automatique. <kbd>Maj</kbd> : se lever. Les gaz se coupent, et on
      marche dans la fusée, même en plein vol.</li>
      <li>Les commandes sont douces : la fusée se met à tourner puis s'arrête sans à-coup ; une grosse
      fusée tourne plus lentement (le couple de ses propulseurs de contrôle).</li>
      <li><kbd>G</kbd> : l'<b>assistance de vol</b>. Active : lâcher les commandes arrête la rotation,
      et dans l'espace les propulseurs latéraux annulent la dérive (la fusée va où pointe son nez).
      Coupée : la physique pure, la fusée garde sa rotation et sa lancée ; on contre une rotation
      avec la touche opposée, on peut pivoter pour freiner en poussant à l'envers.</li>
      <li>Le tableau de bord donne le rapport <b>poussée / poids</b> : au-dessus de 1, la fusée décolle.</li>
    </ul>
    <p>Au-dessus de <b>456 blocs</b> d'altitude, en montant : c'est l'<b>espace</b> (page Système solaire).
    La fusée reste la même, on y reste le même : la main, l'inventaire, les blocs. En ligne, tout le
    monde peut piloter et voyager ensemble.</p>
    <h3>La rentrée dans l'air</h3>
    <p>L'air freine ce qui le traverse, et le <b>chauffe</b> : l'air arrêté devant la fusée monte de
    v² / 2 000 degrés (à 650 blocs/s, la vitesse d'orbite d'Hexa, environ 210 °C ; à 3 000 blocs/s, plus de
    4 000 °C : un <b>plasma</b> rose). La coque chauffe jusqu'à ce qu'elle rayonne autant qu'elle reçoit,
    et un bloc face à l'air plus chaud que sa fusion <b>fond</b> : le bois et la laine vers 290 °C,
    l'aluminium 660 °C, le verre 1 100 °C, l'acier 1 400 °C, le tungstène 3 300 °C. Le tableau de bord
    donne la température de la coque. La fusée garde sa vitesse en arrivant au-dessus du sol (au plus
    150 blocs/s) : il faut freiner avant.</p>
    <ul>
      <li><b>Bouclier thermique</b> (4 tuiles : 5 céramiques et 1 lingot de tungstène) : il tient
      3 000 °C et s'use lentement (ablation). Posé face à l'air (sous la fusée, pour une rentrée la
      tête en haut), il protège tout ce qui est derrière lui.</li>
      <li><b>Parachute</b> (<kbd>P</kbd>) : un dôme de 36 m. Il s'ouvre d'abord <b>rifé</b> (6 % de sa
      surface) tant que l'air freine fort, puis en entier. Trop vite (au-delà de ~200 blocs/s au sol),
      il se déchire. Il en faut environ un pour 4 tonnes pour se poser à moins de 10 blocs/s.</li>
      <li><b>Aérofrein</b> (<kbd>H</kbd>) : des volets d'aluminium qui sortent dans l'air ; ils tiennent
      bien plus de vitesse qu'un parachute, mais freinent moins.</li>
      <li><b>Ballon à hydrogène chauffé</b> (<kbd>C</kbd>) : 2 000 m³ de gaz plus chaud (+100 °C) que
      l'air, donc plus léger : il porte d'autant plus que l'air est dense. Dans une géante, la fusée
      se stabilise à la profondeur où le ballon porte son poids : une <b>station flottante</b>.</li>
    </ul>
    <h3>Dans une géante gazeuse</h3>
    <p>Orgon, Mourne et les géantes n'ont pas de sol : leur « surface » est le niveau où l'air pèse
    1 bar. En dessous, la pression et la chaleur montent sans fin : les <b>nuages d'ammoniac</b>
    (~0,7 bar, blancs), d'<b>hydrosulfure d'ammonium</b> (~2 bars, bruns), d'<b>eau</b> (~5 bars,
    les orages et leurs éclairs), puis l'hydrogène de plus en plus chaud, liquide, et tout au fond
    l'<b>hydrogène métallique</b>. Des vents de ~150 blocs/s soufflent en bandes, d'est en ouest.
    Une coque tient <b>200 bars</b> (elle craque au-delà, écrasée au double), une combinaison seule
    <b>6 bars</b>, le scaphandre lourd <b>100 bars</b>.</p>`],
  ['milieux', 'Survivre sur les autres mondes', `
    <p>Hors d'Hexa, l'air, le froid, la chaleur et le rayonnement comptent (en survie).</p>
    <h3>L'air</h3>
    <ul>
      <li>Sans oxygène, on étouffe : <b>casque spatial</b>. Le gaz carbonique et le soufre (Soufra) sont
      <b>toxiques</b> : on y étouffe plus vite. Le méthane et l'hydrogène sont <b>inflammables</b>.</li>
      <li>Le <b>feu</b> a besoin d'oxygène : sans air respirable, un four s'éteint, sauf dans une pièce
      étanche avec un générateur d'oxygène. (La TNT emporte le sien : elle explose partout.)</li>
      <li><b>Air rare</b> (moins de 0,1 bar d'oxygène, très haut) : on s'essouffle et on court mal ; sous
      0,05 bar, l'hypoxie fait mal. <b>Air trop dense</b> : au-delà de ~4 bars, l'ivresse des
      profondeurs (la vue tangue) ; au-delà de 1,6 bar d'oxygène, il devient toxique.</li>
      <li>Une combinaison étanche ne tient qu'une pression : 6 bars (casque spatial), 100 bars
      (scaphandre lourd). Au-delà, elle t'écrase.</li>
    </ul>
    <h3>La température</h3>
    <p>Sans protection, on tient de -15 à 45 °C. Le <b>casque spatial</b> isole de -120 à 120 °C ; le
    <b>scaphandre lourd</b> (un casque spatial, du plomb, du tungstène et de la céramique) de -240 à
    480 °C. Une <b>pièce étanche</b> avec un générateur d'oxygène est chauffée et refroidie : un abri.
    Les gâteaux chauffants réchauffent l'air autour d'eux. Dans un air très mince, la chaleur passe
    mal : on tient plus longtemps. L'eau rafraîchit.</p>
    <h3>Le rayonnement</h3>
    <ul>
      <li>Les <b>ceintures des géantes</b> : leurs lunes proches en reçoivent énormément (comme Io et
      Europe autour de Jupiter). Les <b>pulsars et les magnétars</b> soufflent un vent de particules.
      Dans l'espace et sur les astres sans air ni champ magnétique, le rayonnement cosmique.</li>
      <li>Ce qui protège : l'<b>air</b> (1 bar en arrête presque tout), le <b>champ magnétique</b> de
      l'astre, la <b>roche</b> ou l'eau au-dessus de la tête (creuse un abri), la coque d'un vaisseau,
      le scaphandre lourd.</li>
      <li>On ne le sent pas : le <b>dosimètre</b> (dans l'inventaire) affiche le débit ici et la dose
      reçue. À 1 Sv, les nausées (on a faim plus vite) ; à 2 Sv, on ne guérit plus seul ; à 3 Sv, le mal des rayons fait mal, de plus en
      plus vite. Loin de tout rayonnement, la dose s'efface peu à peu (la moitié en ~1 h).</li>
    </ul>
    <p>Avec un casque ou un scaphandre, sa visière affiche la température, la pression et l'air
    d'ici. Options › Effets… : les effets du milieu à l'écran (aucun, simples, complets).</p>`],
  ['vie', 'La vie des autres mondes', `
    <p>Tout ce que tu croises va dans le <b>carnet d'exploration</b>, onglet <b>Vie</b> : la faune, la flore,
    les microbes et l'écologie (qui mange qui).</p>
    <ul>
      <li><b>Les géantes gazeuses</b> : entre ~0,5 et 8 bars flottent les <b>flotteurs</b>, de grands sacs de
      gaz chaud plus légers que l'air autour. Chacun reste à l'altitude où il flotte et dérive avec les vents.
      Les <b>chasseurs</b>, petits et rapides, les broutent.</li>
      <li><b>Les abysses</b> : sous plus de 10 blocs d'eau d'une autre planète, des bancs de
      <b>poissons-lanternes</b> (ils font leur propre lumière) et des <b>baudroies</b> avec leur leurre.</li>
      <li><b>L'écologie</b> : les prédateurs d'une planète chassent ses herbivores (quand aucun joueur n'est
      à portée), puis restent rassasiés un moment. Les herbivores fuient et <b>migrent</b> vers le pôle
      d'été. Sur une planète synchrone (Vesper), la vie ne tient qu'au <b>crépuscule</b>.</li>
      <li><b>Le microscope</b> (verre, quartz, 3 aciers) : clic droit sur un bloc. Tu y verras des
      thermophiles dans le soufre chaud, des psychrophiles dans la glace, des halophiles roses dans le sel,
      des cellules radiorésistantes sous un fort rayonnement, de possibles azotosomes dans le méthane, des
      endolithes dans la roche des mondes à air mince... ou rien du tout. Sans liquide, il n'y a pas de vie.</li>
    </ul>
    <p>Options › Effets… : la vie extraterrestre (aucune, un peu, beaucoup).</p>`],
  ['ressources', 'Ressources des autres mondes et terraformation', `
    <p>Chaque monde a ce qui lui est propre. Il faut aller le chercher, et le transformer.</p>
    <h3>Les machines</h3>
    <ul>
      <li><b>Collecteur atmosphérique</b> (50 W ; aluminium, tuyau, acier, circuit) : il aspire l'air
      d'ici et le liquéfie dans un réseau de tuyaux qui le touche. Dans l'hydrogène d'une géante gazeuse,
      de l'<b>hydrogène liquide</b> et un peu d'<b>hélium-3</b> (un réseau pour chacun). Dans l'air de méthane d'un monde glacé,
      du <b>méthane liquide</b>. Dans le CO₂ ou l'air, de l'<b>oxygène liquide</b>. Plus l'air est
      dense, plus il en tire. Dans le vide, il ne fait rien.</li>
      <li><b>Four à régolithe</b> (60 W) : le vent de l'étoile a déposé de l'hélium-3 dans la poussière
      des lunes sans air. 8 régolithes chauffés donnent 10 mB d'hélium-3.</li>
      <li><b>Réacteur à fusion</b> (tungstène, aimants, circuits, un réacteur) : il fusionne l'hélium-3 avec
      du deutérium, sans déchets radioactifs. Il donne <b>3 000 W</b> pour 0,2 mB d'hélium-3 par seconde.</li>
      <li><b>Presse à enclumes de diamant</b> (400 W) : 2 000 mB d'hydrogène liquide écrasés entre deux
      diamants bruts, sous des millions de bars, donnent 250 mB d'<b>hydrogène métallique</b>. C'est le
      meilleur carburant de fusée (5 fois le carburant ordinaire). Le méthane liquide vaut 1,1.</li>
    </ul>
    <h3>La terraformation</h3>
    <p>Un <b>terraformeur</b> (200 W, avec un coffre) posé sur une autre planète change l'air et le climat
    de <b>toute la planète</b>. C'est lent : il faut plusieurs terraformeurs et beaucoup de temps.</p>
    <ul>
      <li>De la <b>glace d'azote</b> dans son coffre : de l'azote, le gaz neutre d'un air respirable.</li>
      <li>Relié à de l'<b>oxygène liquide</b> : il le verse dans l'air.</li>
      <li>De la <b>glace</b> dans son coffre : il sème des microbes qui changent le CO₂ ou le soufre en
      oxygène.</li>
      <li>Il réchauffe un monde froid par effet de serre (il faut déjà un peu d'air) et refroidit un monde
      chaud avec des voiles d'ombre en orbite, vers 15 °C.</li>
      <li>Il s'arrête de verser quand l'air ressemble à celui d'Hexa (1 bar, dont 0,21 d'oxygène).</li>
      <li>L'air devient <b>respirable</b> avec au moins 16 % d'oxygène (entre 0,16 et 0,5 bar), presque
      plus de gaz toxique, une pression de 0,5 à 3 bars et une température de -20 à 45 °C.</li>
      <li>Une petite planète sans champ magnétique perd peu à peu son air : le vent de l'étoile l'arrache.</li>
    </ul>
    <h3>Tenir une base</h3>
    <p>Clic droit sur le noyau d'une base ou d'une station, section <b>Air, eau, énergie</b> : les
    générateurs d'oxygène allumés, l'eau des tuyaux, bidons et blocs de glace des entrepôts, et les jours
    que ça fait pour une personne (3 L par jour, recyclés à 90 %). On y voit aussi le courant produit et
    demandé, et les batteries.</p>`],
  ['stations', 'Stations et vaisseaux automatisés', `
    <p>Tout commence par un <b>noyau de station</b>. Dans l'espace, il fixe la bulle pour de bon et la
    met en orbite autour de l'astre le plus proche ; au sol, il crée une base (portée 96 blocs). Clic
    droit : son nom, son état. Les stations ont un repère à l'écran, les bases sont sur la carte.</p>
    <h3>La station</h3>
    <ul>
      <li><b>Générateur d'oxygène</b> (8 W) : la pièce fermée qui le touche (4 096 cases au plus)
      devient respirable sans casque. Une pièce percée dans le vide se vide d'un coup : la
      <b>décompression</b> aspire les joueurs et les objets vers la brèche.</li>
      <li><b>Générateur de gravité</b> (20 W) : la gravité à moins de 16 blocs.</li>
      <li><b>Panneau solaire</b> : 30 W à la distance d'Hexa, plus près de l'étoile, moins loin
      d'elle, et presque rien près d'Érèbe. Au sol, rien la nuit.</li>
      <li><b>Port d'amarrage</b> : il compte comme un tuyau et un câble. Un vaisseau amarré fait le
      plein dans le réseau de carburant qui le touche, et recharge ses batteries.</li>
      <li><b>Entrepôt orbital</b> : un coffre comme les autres pour les tapis et les bras ; c'est là
      que puisent les vaisseaux et les lanceurs.</li>
      <li><b>Lanceur de cargo</b> (40 W) : envoie les entrepôts de son site vers un autre site.</li>
      <li><b>Baie de drones</b> (15 W) : range-y des <b>drones de minage</b>, ils vont dans la ceinture
      d'astéroïdes et y déposent minerais et glace.</li>
    </ul>
    <h3>Les modules</h3>
    <p>Une station se construit aussi en <b>modules</b> tout faits, fabriqués à l'établi. Dans l'espace,
    prends-en un en main : son fantôme apparaît devant toi, <b>bleu</b> si la place est libre, <b>rouge</b>
    s'il touche un bloc. La touche de l'axe de la main gravitationnelle le tourne, clic droit le pose.
    Le premier module posé dans une bulle apporte le noyau de la station.</p>
    <ul>
      <li><b>Habitat</b> : une grande pièce close, éclairée, avec son oxygène, sa gravité, une batterie et
      ses panneaux solaires ; coffres, table et four. Deux sas, face à face.</li>
      <li><b>Serre</b> : un dôme de verre, de l'eau au centre, du blé sur la terre labourée tout autour.</li>
      <li><b>Quai</b> : une plateforme ouverte, son port d'amarrage, un réservoir, une batterie, un mât
      solaire et deux entrepôts orbitaux.</li>
      <li><b>Observatoire</b> : une petite pièce de verre et sa <b>console de satellites</b> (clic droit :
      l'état des satellites).</li>
      <li><b>Couloir</b> : une coursive de 7 cases, ouverte aux deux bouts, pour relier les sas des
      modules. Les modules ne s'emboîtent pas seuls : place les couloirs contre leurs portes.</li>
    </ul>
    <h3>Les satellites de cartographie</h3>
    <p>Lâche un <b>satellite de cartographie</b> (clic droit) en orbite au-dessus d'une planète, entre 300
    et 150 000 blocs du sol. Il tourne autour d'elle tout seul, même quand personne n'est là, sur une
    orbite presque polaire qui pivote un peu à chaque tour : en une demi-heure, il a vu toute la
    planète. Ce qu'il survole se dévoile sur la <b>carte du monde</b>, et les biomes vont au
    <b>carnet d'exploration</b> (quelques gisements aussi ; le scanner orbital reste plus précis). On
    est prévenu à 25, 50, 75 et 100 %. Dans l'espace, on le voit passer : un petit point qui clignote.
    En multijoueur, c'est l'hôte qui les lâche.</p>
    <h3>Les vaisseaux</h3>
    <p>Pose un <b>ordinateur de bord</b> et un <b>port d'amarrage</b> sur ton vaisseau. Les coffres à bord
    sont ses soutes. Pour s'amarrer à la main : arrive doucement, le vaisseau droit, un port contre
    un port. Un peu de gaz pour se détacher.</p>
    <p>Clic droit sur l'ordinateur : ajoute des étapes (décoller, sauter, s'amarrer, charger, attendre...)
    ou crée une <b>route cargo</b> entre deux sites, qui part quand les soutes sont pleines, à heure
    fixe ou sur signal radio. Le vaisseau vole tout seul, même loin de tout joueur.</p>
    <p>Radio : une étape peut attendre un signal ou en émettre un, et l'ordinateur peut prévenir sur
    une fréquence quand les soutes sont pleines. Il faut un réacteur armé et du carburant.</p>
    <p>À bord, l'oxygène et la gravité marchent sur les batteries du vaisseau, rechargées au port
    ou par des panneaux solaires.</p>`],
  ['systeme', 'Système solaire', `
    <p>L'étoile <b>Hexa</b> et ses astres, à leur vraie échelle : des milliers de blocs de rayon, des
    millions (et jusqu'à des milliards) de blocs entre eux. Ils tournent sur leurs orbites pendant
    que le temps passe.</p>
    <ul>
      <li><b>Magmara</b> : collée à l'étoile, volcans et fleuves de lave, gravité ×0,8. Cramoisite, obsidienne, tungstène.</li>
      <li><b>Soufra</b> : air jaune épais et toxique, dunes, plateaux et canyons, croûtes de sel, gravité ×0,9. Voltite.</li>
      <li><b>Hexa</b>, notre planète, dans la ceinture d'astéroïdes intérieure, et sa <b>Lune</b> :
      sans air, cratères, mers de basalte, tunnels de lave, gravité ×0,17. Platine, tungstène.</li>
      <li><b>Ocra</b> : la planète rouge, poussière ocre, un canyon immense, un volcan géant, glace aux pôles, gravité ×0,38. Fer.</li>
      <li><b>Orgon</b> : géante gazeuse, sans sol. Ses lunes : <b>Brasia</b> (volcans de soufre, ×0,18)
      et <b>Azura</b> (croûte de glace fissurée sur un océan, ×0,13).</li>
      <li><b>Cryos</b> : géante de glace couchée, avec ses anneaux. Sa lune <b>Glacia</b> : banquises,
      crevasses, mers glaciales, ×0,25. Fluorite, platine.</li>
      <li>Après la ceinture extérieure, <b>Nox</b> : planète naine de glace d'azote et de tholins, ×0,07.</li>
    </ul>
    <h3>La Voie lactée : 20 000 systèmes</h3>
    <ul>
      <li>La <b>Voie lactée</b> est la galaxie de la Terre, à <b>2,5 millions d'années-lumière</b> d'Hexa (Hexa, elle, est dans <b>Andromède</b> : voir plus bas). Ses <b>20 000 systèmes</b> : une grande spirale à quatre bras,
      plus dense vers son centre. Naines rouges, orange, jaunes, géantes bleues et rouges, naines blanches, étoiles à neutrons,
      pulsars, magnétars, trous noirs. Quelques étoiles connues sont à leur vraie place vue de la Terre : Proxima et Alpha du Centaure, Sirius,
      Véga, Bételgeuse, Rigel, Deneb, le pulsar du Crabe, Cygnus X-1...</li>
      <li>Chacun a un <b>monde où se poser</b> (volcanique, désert, glace, ou tempéré avec mers et forêts) et parfois des géantes ou une deuxième étoile.
      On y va comme vers Érèbe : vise l'étoile au centre de l'écran, N, puis le saut (J). Il prend vie quand on s'en approche.</li>
      <li>Chaque planète a <b>ses biomes</b> : champs d'éjecta, mers de basalte, terrasses d'argile, forêts de cheminées de fée, champs de séracs, lames de méthane, forêts de cristaux, affleurements de cuivre ou de titane... selon sa latitude, son altitude, ses grandes régions, sa température (et, sur une planète synchrone, la hauteur de son astre). La <b>carte du monde</b> les colore, et sa légende ne montre que ceux de la planète où l'on est.</li>
      <li>Au centre, à <b>26 673 années-lumière de la Terre</b> (dans la direction du Sagittaire) : <b>Sagittarius A*</b>, le trou noir supermassif,
      4,3 millions de fois la masse du Soleil, et l'étoile <b>S2</b> qui le frôle tous les 16 ans.</li>
    </ul>
    <h3>La galaxie d'Andromède, celle d'Hexa : 21 806 systèmes</h3>
    <ul>
      <li><b>Hexa est dans Andromède</b>, dans un de ses deux bras, à <b>26 000 années-lumière de son centre</b>. Ses voisines et ses nébuleuses (la Pouponnière de Vélane, le Nuage de Brume-Noire...) sont autour d'elle, à portée d'un premier saut. Vue de la Terre, Andromède est la grande galaxie voisine, à <b>2,5 millions d'années-lumière</b>, dans sa vraie direction (vers la constellation d'Andromède) : une spirale un peu plus grande que la Voie lactée.</li>
      <li>Ses <b>21 806 systèmes</b> sont comme ceux de la Voie lactée : chacun son étoile, son monde où se poser, parfois des géantes ou une compagne.
      Un gros <b>bulbe</b> de vieilles étoiles, deux bras peu enroulés, l'<b>anneau de feu</b> (à 33 000 années-lumière de son centre) où naissent
      les étoiles bleues, et ses deux petites galaxies compagnes, <b>M32</b> et <b>M110</b>. En son cœur : <b>M31*</b>, son trou noir géant.</li>
      <li>Aller dans la Voie lactée (et jusqu'à la Terre) est un voyage immense : même au meilleur réacteur de saut (environ une année-lumière par seconde), il faudrait près d'un mois sans s'arrêter.
      Le seul chemin : un des rares <b>grands tunnels de la 7ème dimension</b>, du bord d'Andromède au bord de la Voie lactée (voir le moteur de 7ème dimension), environ 28 heures.
      D'Hexa, la Voie lactée n'est qu'une petite tache pâle.</li>
    </ul>
    <h3>Les nébuleuses et les étoiles qui naissent</h3>
    <ul>
      <li>Près de <b>800 nébuleuses</b>, de vrais volumes de gaz et de poussière qu'on peut traverser, avec leurs filaments et leurs zones plus denses.
      Leurs couleurs sont celles de la lumière du gaz : le rouge de l'hydrogène, le bleu-vert de l'oxygène au cœur le plus chaud.</li>
      <li><b>Les régions de gaz ionisé</b>, le long des bras de la galaxie : des pouponnières d'étoiles. <b>Les nuages sombres</b> : de la poussière froide
      qui cache les étoiles derrière elle. <b>Les nébuleuses par réflexion</b> : une poussière bleutée, éclairée par l'étoile qu'elle entoure.
      <b>Les nébuleuses planétaires</b> : une coquille de gaz chassée par une étoile mourante, autour de sa naine blanche.
      <b>Les restes de supernova</b> : des filaments autour d'une étoile à neutrons ou d'un pulsar.</li>
      <li>Quelques nébuleuses connues sont à leur vraie place : Orion, la Lagune, l'Aigle, la Carène, la Tête de Cheval, les Pléiades, l'Anneau, l'Hélice, le Crabe, les Dentelles du Cygne...
      Tout près d'Hexa : la <b>Pouponnière de Vélane</b> (160 années-lumière) et le <b>Nuage de Brume-Noire</b>. En y entrant, un message le dit.</li>
      <li>Dans les nébuleuses, des <b>étoiles qui naissent</b> (on les vise et on y saute comme les autres), à quatre âges : un <b>cœur</b> caché dans son cocon,
      deux jets de matière qui partent de ses pôles ; une <b>jeune étoile</b> et son grand disque de gaz et de poussière ; un <b>disque</b> creusé
      d'anneaux vides, là où grossissent des <b>embryons de planètes</b> ; enfin un <b>anneau de débris</b> autour des premières planètes. Le disque tourne
      comme le veut la gravité : vite près de l'étoile, lentement au bord.</li>
      <li>Les embryons de planètes sont <b>encore en fusion</b> : une mer de lave, on ne s'y pose pas (et on y brûle).</li>
    </ul>
    <h3>Les étoiles doubles</h3>
    <ul>
      <li>Environ une étoile sur six a une <b>compagne</b>. Souvent elle est loin (des dizaines ou des centaines d'UA) : une étoile très
      brillante du ciel. Mais dans un couple <b>serré</b>, les deux étoiles tournent l'une autour de l'autre, tout près, et les planètes
      tournent autour des deux.</li>
      <li>Sur ces planètes, il y a <b>deux soleils</b> dans le ciel, qui se lèvent et se couchent l'un après l'autre. Chacun éclaire avec
      sa couleur et fait <b>sa propre ombre</b> : sous l'ombre de l'un, l'autre éclaire encore, les deux ombres sont à moitié sombres.</li>
      <li>La planète reçoit la lumière des deux : elle tourne plus loin, pour avoir la même chaleur qu'avec une seule étoile. Quand un
      soleil est couché et l'autre encore levé, la lumière baisse sans que ce soit la nuit.</li>
      <li><b>Les éclipses</b> : quand les deux étoiles s'alignent vues de la planète, l'une passe devant l'autre. Celle de derrière est
      cachée en partie : sa lumière (et son ombre) baisse d'autant. Un message le dit.</li>
      <li><b>Les novae</b> : dans certains couples serrés, la compagne est une <b>naine blanche</b>. Elle arrache le gaz de l'autre étoile,
      qui s'entasse à sa surface jusqu'à exploser : pendant quelques semaines, elle brille des dizaines de milliers de fois plus (une étoile
      « nouvelle » dans le ciel, bleu-blanc puis jaunissante). Elle survit, et recommence des dizaines d'années plus tard. Vise-la (N) : le panneau le dit.</li>
    </ul>
    <h3>Le ciel qui vit</h3>
    <ul>
      <li><b>La lumière met du temps à voyager</b> : un an pour une année-lumière (un vrai an, soit 17 532 jours de jeu). Ce qu'on voit d'une
      étoile est son passé. Une supernova à 2 000 années-lumière a explosé il y a 2 000 ans : sa lumière arrive seulement. Ailleurs, on ne
      la voit pas au même moment : plus près de l'étoile, plus tôt ; de l'autre côté de la galaxie, bien plus tard. Le saut nédrolytique va plus
      vite que la lumière : sauter vers une étoile qui vient d'exploser, c'est la voir plus vieille ; sauter loin d'elle, c'est parfois
      la voir encore avant l'explosion.</li>
      <li><b>Les comètes</b> : un noyau de glace sur une orbite très allongée. Loin de l'étoile, on ne la voit pas ; en s'approchant
      (moins de 3 UA), la glace se sublime : une chevelure, et deux <b>queues</b>, toujours à l'opposé de l'étoile (le vent stellaire les
      pousse) : la queue d'ions, droite et bleue, et la queue de poussière, plus large, jaunâtre, courbée vers l'arrière. Plus elle est
      près de l'étoile, plus elle est longue et brillante. Hexa en a deux : <b>Ardane</b> (tous les 3 ans et demi, environ 420 jours)
      et la grande comète <b>Ilvéra</b> (tous les 76 ans). Chaque système en a au moins une.</li>
      <li><b>Les pluies d'étoiles filantes</b> : une comète sème sa poussière le long de son orbite. Les orbites d'Ardane et d'Ilvéra croisent
      celle d'Hexa : chaque année, aux mêmes dates, Hexa traverse leur traînée (les <b>Ardanides</b> et les <b>Ilvérides</b>) : deux ou trois
      nuits de nombreuses étoiles filantes, plus fortes les années où la comète vient de passer. Ce ne sont que des grains : rien ne tombe
      jusqu'au sol (pas comme les pluies d'astéroïdes, plus rares, qui creusent des cratères au loin).</li>
      <li><b>Les étoiles variables</b> : les <b>céphéides</b> (des étoiles blanches qui battent : leur éclat monte vite, redescend lentement,
      en quelques jours à quelques semaines) et les <b>supergéantes rouges</b> irrégulières, comme Bételgeuse et Antarès (elles enflent et
      faiblissent sur des mois ; parfois un grand assombrissement : un nuage de poussière qu'elles rejettent). Le panneau de visée le dit.</li>
      <li><b>Les éruptions</b> : un sursaut de lumière à la surface d'une étoile. Les <b>naines rouges</b> en ont souvent, et de très fortes
      (leur éclat peut tripler un instant). Après les plus grosses, un nuage de particules part de l'étoile : il arrive un jour et demi plus tard,
      une <b>tempête stellaire</b> d'une demi-journée. Un message prévient. Sur les planètes qui ont de l'air et un champ magnétique (Hexa, et
      les planètes assez grosses), les <b>aurores</b> s'allument la nuit. <b>Dans l'espace, en survie</b>, sans abri, les particules font mal :
      mets-toi sous un toit (une station, un vaisseau fermé) ou pose-toi. Plus on est près de l'étoile, plus c'est fort.</li>
      <li><b>Les impacts</b> : de temps en temps, un astéroïde frappe une planète ou une lune. De l'espace, on voit l'éclair, puis la lueur rouge
      de la roche fondue, qui refroidit en quelques jours (seulement du côté tourné vers soi). Un message le dit. (Le terrain des planètes n'en
      garde pas de cratère.)</li>
      <li><b>L'observatoire</b> : clic droit sur la console du module observatoire. La galaxie vue de dessus, et son évolution en accéléré, sur
      deux milliards d'années : les étoiles tournent autour du centre (celles du bord bien plus lentement), les massives meurent en supernova
      (un éclair), de nouvelles naissent dans les nuages de gaz, et on suit les tours d'Hexa autour du centre. C'est une <b>simulation</b>, à
      part : elle ne change rien au monde. Les vieilles étoiles s'éparpillent, mais les bras restent : ce sont des ondes qui tournent d'un bloc, où naissent sans cesse des amas bleus et des nuages roses.
      La console donne aussi l'état des satellites.</li>
      <li><b>La couleur des bras</b> : les bras spiraux sont dessinés par les étoiles jeunes : des <b>amas d'étoiles bleues</b> (des géantes nées
      ensemble, qui ne vivent que quelques millions d'années) et les <b>nuages roses</b> d'hydrogène qu'elles allument. Vus d'Hexa, ils piquent la bande
      de la Voie lactée de points bleus et roses ; de plus près, ce sont des lueurs.</li>
      <li><b>L'air</b> : vers l'horizon, la lumière des astres traverse bien plus d'air. Les étoiles y pâlissent et rougissent, puis disparaissent dans
      les derniers degrés (sur une planète sans air, elles restent nettes jusqu'au sol). La nuit, l'air a sa propre <b>lueur</b>, très faible : des
      bandes verdâtres un peu au-dessus de l'horizon, un peu de rouge plus haut. Près des <b>villages</b>, leurs lumières font une lueur orange au-dessus
      de l'horizon, dans leur direction, et éclairent les nuages par-dessous ; au milieu d'un village, le ciel entier s'éclaircit et les étoiles
      faibles s'y perdent : pour bien voir le ciel, éloigne-toi.</li>
    </ul>
    <h3>La vie des étoiles et les supernovas</h3>
    <ul>
      <li>Chaque étoile de la Voie lactée a sa <b>masse</b>, son <b>âge</b> et son avenir : vise-la (N), le panneau le dit. Une naine rouge brillera
      des milliers de milliards d'années ; une étoile comme le Soleil gonflera en géante rouge puis finira en naine blanche ; une géante bleue vit
      vite, quelques millions d'années. Le temps des étoiles est presque réel : on ne les voit pas vieillir, le ciel est tel qu'il est maintenant.</li>
      <li>Seules les étoiles de plus de 8 fois la masse du Soleil arrivées au bout (des <b>géantes bleues</b> et des <b>supergéantes rouges</b>,
      comme Bételgeuse) peuvent exploser pendant une partie. C'est rare : environ une fois tous les 100 jours, quelque part dans la galaxie,
      le plus souvent à des milliers d'années-lumière. Elles explosent même quand tu n'es pas là, et chaque monde a les siennes.</li>
      <li><b>Avant</b> : quelques jours de sursauts d'éclat. Dans son système, un message te prévient : éloigne-toi.
      <b>L'explosion</b> : son cœur s'effondre, l'éclat monte en un jour et demi jusqu'à un milliard de soleils, reste fort trois semaines
      en passant du bleu au jaune, puis s'efface pendant des mois en rougissant. Une étoile nouvelle dans le ciel, visible de toute la galaxie,
      et même en plein jour si elle est assez proche.</li>
      <li><b>Après</b> : l'étoile est devenue un <b>pulsar</b>, et ses débris, à 10 000 km/s, forment une coquille de filaments qui grandit
      (près de 6 UA par jour) : le reste de la supernova, qui traverse son système.</li>
      <li><b>Le danger</b> : dans l'espace, en survie, sa lumière brûle à quelques milliers d'UA, et tue à quelques centaines. Au sol, l'air protège.</li>
    </ul>
    <h3>Explorer les autres mondes</h3>
    <ul>
      <li><b>Le carnet d'exploration</b> est un objet (3 laines blanches en haut, puis planche, charbon, planche) : en main, clic droit pour l'ouvrir ;
      quand on l'a sur soi, la touche <b>L</b> ou le menu pause l'ouvrent aussi (en créatif, toujours). Il note ce qu'on découvre même avant de l'avoir. Chaque biome où l'on marche se coche, et les biomes des autres planètes forment une collection (près de 180).
      Chaque planète visitée a sa page : mets-la en <b>favorite</b> (★) et écris-y ta propre description ; les systèmes visités et les <b>étoiles célèbres</b> atteintes (Sirius, Véga, Bételgeuse...
      et Sagittarius A*) s'y cochent aussi. Récompenses : des succès (catégorie Exploration), des <b>plans</b> (le scanner orbital II, la lanterne de cristal, le tapis de mousse : leur recette ne se fait
      qu'une fois le plan obtenu) et des capes d'explorateur.</li>
      <li><b>Le scanner orbital</b> (fer, circuit, cristal de quartz, voltite) : tenu en main au-dessus d'une planète, en orbite, un clic droit révèle les biomes et les <b>gisements</b> de la région
      sous le vaisseau. En survie, la carte du monde ne montre d'abord que ce qu'on a exploré ou scanné ; les gisements y sont marqués d'un losange. Le scanner II (un plan : titane et diamant) voit plus loin et plus large.</li>
      <li><b>Des ressources propres à certains biomes</b>, dans la roche sous eux : le <b>diamant</b> ne se trouve plus que sur les mondes de type Voss (champs d'aiguilles et gisements de diamant),
      l'iridium dans la poussière d'iridium de Lethe, l'uranite dans les dunes irradiées de Halo, la gravitite dans les failles lumineuses de Perse, le titane dans les affleurements d'ilménite des lunes...</li>
      <li><b>La faune des biomes</b> : les planètes sans espèces à elles ont des créatures adaptées à leurs biomes : au froid (brouteurs de givre, traqueurs des glaces), à la chaleur (rampants des cendres,
      salamandres de braise), au vide (lithophages, rôdeurs du vide), aux terres sèches (sauteurs des dunes, dards des sables), au tempéré (paisseurs, rôdeurs des prairies), et des lanternes vivantes
      dans les biomes lumineux. Leur couleur change d'une planète à l'autre.</li>
      <li><b>La météo des planètes</b> qui ont de l'air : tempêtes de poussière sur les mondes secs (type Mars), pluie de soufre sur les mondes brûlants, pluie de cendres sur les mondes volcaniques,
      blizzards sur les mondes glacés, averses ailleurs. La nuit, des <b>aurores</b> : leur couleur dépend de l'étoile (rouges sous une naine rouge, bleues sous une étoile bleue, vertes et violettes près d'un pulsar).</li>
      <li><b>Les plantes extraterrestres</b> : on les trouve sauvages, mûres, dans les biomes qui leur vont ; leur récolte se replante sur le sol de leur genre de monde, sans terre labourée ni eau.
      La <b>mousse violette</b> sur les sols froids (régolithe, pergélisol, toundra, tholins), les <b>cristaux végétaux</b> sur les sols minéraux (quartz, sel, sable de cristal),
      le <b>lichen de braise</b> sur les sols brûlants (basalte, cendre, soufre), les <b>bulbes des dunes</b> sur les sols secs (ocre, sable rouge, argile). Pour cultiver ailleurs, rapporte leur sol.</li>
    </ul>
    <h3>Le système d'Érèbe, à 24,8 années-lumière</h3>
    <ul>
      <li>Pour y aller : dans l'espace, vise l'étoile <b>Érèbe</b> au centre de l'écran, appuie sur N et choisis-la comme repère, puis lance le saut (J). Le saut devient
      interstellaire et se guide tout seul, jusqu'à 250 G b/s avec le réacteur classique : environ 7 min pour Érèbe (24,8 a.l.), 2 min pour Pipiens (7,7 a.l.).
      Avec un réacteur renforcé (750 G b/s), trois fois moins ; avec un réacteur nédrolytium-voltite (1 a.l./s), Érèbe en une trentaine de secondes de croisière. Même chose pour revenir : vise l'étoile Hexa.</li>
      <li><b>Érèbe</b> est un trou noir. Son horizon est sans retour : la fusée ou le joueur qui le franchit est perdu. En créatif, on en est repoussé.
      Sa gravité finit par dépasser toute poussée, il n'y a plus d'orbite possible à moins de 3 rayons, et rien n'y va plus vite que la lumière.</li>
      <li>Près de lui, les marées étirent et déchirent ce qui s'approche (2,2 rayons pour un joueur, 1,5 pour une fusée), son disque d'accrétion brûle, et le temps
      ralentit : pour toi quelques secondes, dehors des heures (en solo). Le tableau de bord donne la distance à l'horizon et le facteur de temps.</li>
      <li><b>Vesper</b> (×1,6) montre toujours la même face à Érèbe : l'astre ne bouge jamais dans son ciel. Face à lui, des mers de lave (jusqu'à 1400 °C) ; à l'opposé, une nuit
      éternelle de glace et de neige. L'air n'est respirable et la température supportable que sur la bande du crépuscule, là où Érèbe touche l'horizon. Crimsonite, tungstène.</li>
      <li><b>Pélagia</b> (×0,8) est un océan entièrement gelé : banquise, icebergs pris dans la glace, fissures d'eau libre, et plus de cent blocs d'eau glaciale sous la croûte.
      Sans air. Fluorite et platine au fond, voltite sur ses rares îles.</li>
    </ul>
    <h3>Le système PXT, à 45 années-lumière</h3>
    <ul>
      <li>Deux étoiles : <b>PXT-A</b>, blanche et plus brillante qu'Hexa, et la naine rouge <b>PXT-C</b>, qui fait le tour de PXT-A très loin d'elle.
      On y va comme vers Érèbe : vise PXT-A, N pour la prendre comme repère, puis le saut (J).</li>
      <li><b>PXT-3</b> (×1,1), tout près de PXT-A : fer brûlant, lave et basalte. Fer, tungstène.</li>
      <li><b>PXT-1</b> (×0,7), plus loin : désert de sable et de grès, air trop mince. Fer, charbon, voltite.</li>
      <li>En orbite autour de PXT-1 : <b>Hexa-Zéro</b>, la station où tu as été formé. De gros astéroïdes l'ont percée et
      personne n'est venu la réparer : sans air, sans gravité, sans lumière, vidée de tout ce qui avait de la valeur. Son
      repère s'affiche dans l'espace ; sa coque tordue ne se démonte plus.</li>
      <li><b>PXT-2</b> (×0,5), autour de PXT-C : tout est gelé, glace bleue et mers glaciales. Fluorite, platine.</li>
      <li>Les panneaux solaires y donnent plus près de PXT-A (deux fois l'éclat d'Hexa), presque rien autour de PXT-C.</li>
    </ul>
    <h3>Le système Pipiens, à 7,7 années-lumière</h3>
    <ul>
      <li>Deux étoiles qui tournent l'une autour de l'autre en 112 jours : <b>Azurion</b>, naine blanc-bleu (8 fois l'éclat d'Hexa), et <b>Cendre</b>, naine orange terne.
      Les planètes font le tour des deux. On y va comme vers PXT : vise l'une des deux étoiles, N pour la prendre comme repère, puis le saut (J).</li>
      <li><b>Eldra</b> (×1,09), à 3,1 UA sur une orbite un peu ovale : air respirable, océans, deux continents, un archipel volcanique, la Cordillère d'Orvane,
      une mer intérieure aux tapis microbiens colorés, des plaines de sel blanc, l'arc volcanique de basalte noir de la côte est. Pas d'arbres : des lichens et des mousses violet-noir.
      Sa lune : <b>Lunule</b>.</li>
      <li><b>Glacyon</b> (×0,31), à 30 UA : −193 °C, sans air. Plaines d'azote gelé blanc-rose, montagnes de glace d'eau, cryovolcans, dunes de tholins rouge-brun.</li>
    </ul>
    <h3>Le système Ethan, à 30 années-lumière</h3>
    <ul>
      <li>Deux étoiles à neutrons qui tournent l'une autour de l'autre en 9,3 jours, restes de deux supernovae : <b>Ethan Alpha</b>, un pulsar,
      et <b>Ethan Bêta</b>, un magnétar dormant. Presque pas de lumière visible : deux points noirs dans un halo violet, et les deux faisceaux d'Alpha
      qui balaient le ciel. Sur ses planètes, le jour est faible et bleuté, et les panneaux solaires ne donnent presque rien.
      On y va comme vers les autres systèmes : vise Ethan dans le ciel, N pour le prendre comme repère, puis le saut (J), environ 8 min.</li>
      <li><b>Cinder</b> (×0,6), à 0,35 UA, toujours la même face vers les pulsars, sans air : une mer de fer fondu le jour,
      des plaines de scories noires et une croûte rouge-orange qui brille la nuit, des geysers de métal. Beaucoup de fer.</li>
      <li><b>Voss</b> (×1,4), la planète-diamant : plateaux de graphite noir, falaises et aiguilles de diamant brut qui luisent en bleu,
      rivières de carbure, lacs d'hydrocarbures figés en verre noir. Air irrespirable (3 atm, 120 °C).</li>
      <li><b>Halo</b> (×1,1), le monde habitable : air respirable, un océan peu profond aux récifs bleu électrique, des forêts de cristaux végétaux,
      des plaines de verre noir, des falaises d'aurore. Pas de soleil : le ciel est rempli d'aurores vertes, roses et dorées, et il n'y fait jamais nuit noire.</li>
      <li><b>Tessel</b> (×0,8) : désert cristallin, dunes de sable de cristal, plateaux et aiguilles de quartz, canyons aux parois de quartz et de sel. Air trop mince.</li>
      <li><b>Mourne</b>, géant irradié aux anneaux sombres (pas de sol), et ses lunes : <b>Ash</b> (volcanique), <b>Pale</b> (glacée)
      et <b>Orrin</b> (la plus grande, un océan sous la glace).</li>
      <li><b>Perse</b> (×1,2), à 5 UA : glace bleue fracturée sur un océan profond, failles lumineuses, cryovolcans géants.</li>
      <li><b>Lethe</b> (×0,5), la planète fantôme, capturée sur une orbite très ovale : toute noire, poussière noire, cratères et crevasses profondes, −220 °C.</li>
    </ul>
    <h3>Une tour jusqu'à l'espace</h3>
    <ul>
      <li>Il n'y a pas de limite de hauteur : on pose des blocs aussi haut qu'on veut, on marche dessus, et tout reste
      dans la sauvegarde. Tant qu'on est tout près d'une tour (une cinquantaine de blocs), on reste au-dessus de la carte, même
      au-delà de 456 blocs ; en s'en éloignant, on est dans l'espace. En revenant près d'elle depuis l'espace, on la retrouve.</li>
      <li>Tout en haut, l'air manque (au-dessus de 456 blocs, sans casque spatial, on perd de la vie) et la gravité
      baisse à partir de 356 blocs : à 456 blocs, il n'y en a plus du tout et on flotte comme dans l'espace.</li>
    </ul>
    <h3>Un train d'un astre à l'autre</h3>
    <ul>
      <li><b>/voie espace glacia</b> (ou un autre astre solide), depuis le sol : une rampe monte sur ses tours jusqu'à la hauteur 500,
      la ligne spatiale part de là, une autre rampe redescend sur l'astre d'arrivée, avec une gare et un butoir à chaque bout.</li>
      <li>À la main : pose deux bouts de voie au-dessus du monde (hauteur 156 ou plus), un sur chaque astre,
      Maj + clic droit sur le premier, clic droit sur le second (64 rails de train en survie).</li>
      <li>Dans l'espace, la ligne est une grande courbe, qui se voit de loin : elle quitte l'astre de départ à l'horizontale et se pose de la même façon sur celui d'arrivée.</li>
      <li>On s'y comporte comme sur n'importe quels rails : on y marche, on y pose des wagons et des blocs.</li>
      <li>Sur la ligne, le train file tout seul : environ une minute, quelle que soit la distance. Pendant le trajet, on voit les astres par la fenêtre.
      Il reprend sa vitesse normale juste avant l'arrivée. Il n'y a aucune coupure : le terrain s'efface sous le train au départ et réapparaît à l'arrivée.</li>
      <li>On peut s'arrêter en route : <kbd>S</kbd> freine (une dizaine de secondes à pleine vitesse), <kbd>Z</kbd> repart.
      On peut aussi descendre, même lancé : le train s'arrête net et attend. On flotte alors le long de la voie, et on remonte d'un clic droit sur le train.
      À plus de 64 blocs de la voie, on part dans le vide de l'espace et on ne retrouve plus le train.</li>
    </ul>
    <h3>Dans l'espace : c'est toujours le jeu</h3>
    <ul>
      <li>Il n'y a pas de mode à part : au-dessus de 456 blocs, on continue à jouer. Plus de gravité,
      la planète ronde sous les pieds, les astres à leur vraie place. On garde son inventaire, on pose
      et on casse des blocs, on se lève du poste et on marche dans la fusée pendant le vol.</li>
      <li>Rien ne freine dans le vide : on garde sa vitesse. La gravité de l'astre le plus proche
      attire tout ce qui est autour de nous : on peut se mettre en orbite, ou retomber. Sans assez de
      vitesse, on redescend là d'où l'on vient.</li>
      <li><b>Aux commandes</b> : <kbd>Z</kbd> / <kbd>S</kbd> les gaz, <kbd>X</kbd> couper, flèches :
      pencher vers où l'on regarde, <kbd>Q</kbd> / <kbd>D</kbd> : roulis. <kbd>R</kbd> / <kbd>F</kbd>
      tenus : le nez vers l'avant / l'arrière de la trajectoire (pour freiner).</li>
      <li><kbd>J</kbd> aux commandes : <b>saut nédrolytique</b> dans la direction du nez (il faut un
      réacteur armé). D'abord la <b>préparation</b> : le réacteur monte en puissance et charge la bulle, 4 secondes
      plus 0,06 seconde par tonne de fusée (25 secondes au plus), en brûlant peu à peu 200 mB par tranche de 25 tonnes
      (<kbd>J</kbd> pendant la préparation : l'annuler). Puis 30 mB par seconde, et la vitesse double toutes les
      1,5 seconde. <kbd>J</kbd> pour en sortir. En survie, voir plus bas ce que coûte la distance. Un astre droit
      devant le casse avant qu'on s'y écrase. Chaque saut laisse une <b>traînée bleue</b> derrière lui,
      visible de partout pendant 5 minutes : on voit d'où est parti un autre joueur ou un vaisseau sur
      son programme, et vers où il file.</li>
      <li><kbd>K</kbd> pendant un saut : la <b>surcharge</b>. Le saut va <b>10 fois plus vite</b> et brûle
      3 fois plus de carburant. L'espace-temps tient <b>5 minutes</b> (comptées sur tout le saut, le tableau
      de bord affiche le temps qui reste) ; ensuite il <b>se fissure</b> autour de la fusée (de vraies fissures
      lumineuses, tout autour d'elle), et des fissures s'ouvrent <b>droit devant</b> elle, de plus en plus
      souvent. Pour en esquiver une, il faut <b>tourner la fusée</b> en moins de 3 secondes. Une fissure
      prise de face s'ouvre en grand et avale la fusée : la <b>7ème dimension</b>, où rien n'a de sens (formes
      impossibles, yeux géants, escaliers sans fin, « 7 » qui flottent, pluie qui tombe vers le haut). Une fois sur deux on ne fait
      qu'y passer ; sinon on y reste bloqué, <b>25 secondes au plus</b>. On en ressort n'importe où à moins de
      <b>500 années-lumière</b>, le plus souvent au milieu de nulle part, parfois près d'un astre.
      Là où la fusée est tombée, une <b>fissure</b> reste ouverte dans l'espace, visible de loin, et se
      referme doucement : il n'en reste plus rien au bout de <b>17 minutes</b>. <kbd>K</kbd> à nouveau
      pour revenir au saut normal. En survie, la coque en rapporte <b>1 à 3 éclats de 7ème dimension</b>.</li>
      <li><b>Le moteur de 7ème dimension</b> : la technologie la plus rare de toutes. Il ne crée pas de chemin :
      la <b>Seed</b> du monde a déjà tracé des <b>tunnels</b> à travers l'univers, dans une couche au-dessus de
      l'espace, invisibles. Le moteur déchire un moment la séparation, et la fusée passe dans un tunnel.
        <ul>
          <li><b>Le fabriquer</b> : une <b>forge dimensionnelle</b> (acier sombre, blocs de voltite, nédrolytium,
          réacteur renforcé, circuits), branchée sur un énorme réseau électrique (<b>1 500 W</b> ; avec moins, elle
          travaille d'autant plus lentement). On y met un <b>noyau dimensionnel brut</b> (un réacteur au
          nédrolytium-voltite entouré de 4 <b>éclats de 7ème dimension</b>, de voltite et de nédrolytium) ;
          10 minutes plus tard, le moteur sort.</li>
          <li><b>L'installer</b> : n'importe où sur le vaisseau (posé sur un de ses blocs, pour qu'il en fasse partie).
          Il prend l'énergie du vaisseau : il lui faut un <b>réacteur armé</b> (de n'importe quel type) ou un moteur
          qui marche seul (chimique, plasma).</li>
          <li><b>Trouver un tunnel</b> : le moteur sent les entrées à moins de <b>600 années-lumière</b> (le tableau
          de bord dit près de quelle étoile). Une entrée flotte à moins d'une année-lumière de son étoile : on saute
          jusqu'à l'étoile. L'un des tunnels part d'une des étoiles les plus proches d'Hexa.</li>
          <li><kbd>I</kbd> près de l'entrée : la <b>brèche</b> met 12 secondes à s'ouvrir (4 000 mB de carburant en
          survie). Elle est instable : parfois elle se referme avant de tenir. Il faut ensuite 90 secondes au
          moteur pour se stabiliser.</li>
          <li><b>Dans le tunnel</b> : la fusée file jusqu'à <b>25 années-lumière par seconde</b>, sur la vraie distance
          entre les deux bouts ; on ne peut pas en sortir avant. Les tunnels vont de quelques centaines à des
          dizaines de milliers d'années-lumière (quelques minutes).</li>
          <li>Quelques <b>grands tunnels</b>, rares, relient le bord de la <b>galaxie d'Andromède</b> (celle d'Hexa)
          au bord de la <b>Voie lactée</b> (celle de la Terre) : 2,5 millions d'années-lumière, environ <b>28 heures</b> de traversée.</li>
          <li>Les tunnels sont les mêmes pour tous les joueurs d'un monde ; d'un monde à l'autre, tout change.</li>
        </ul></li>
      <li><b>En survie, le saut se mérite</b> :
        <ul>
          <li><b>La distance se paie</b> : 60 mB par année-lumière et par tranche de 25 tonnes de fusée (deux fois plus en surcharge).
          Une fusée de 30 tonnes brûle 360 mB par année-lumière.</li>
          <li><b>La portée d'une bulle</b> : au-delà, elle ne tient plus et le saut s'arrête. Réacteur au nédrolytium :
          <b>25 années-lumière</b> ; renforcé : <b>60</b> ; nédrolytium-voltite : <b>200</b>. Les longs voyages se font en plusieurs sauts.
          Vise une étoile (N) : le panneau dit en combien de sauts, et le carburant qu'il faut à peu près.</li>
          <li><b>Le refroidissement</b> : après un saut, le réacteur refroidit 15 secondes, plus 4 secondes par année-lumière parcourue
          (4 minutes au plus ; deux fois plus après une surcharge).</li>
          <li><b>L'environnement</b> : près d'un astre, son puits de gravité rend la bulle plus chère et plus longue à former
          (jusqu'à 2,4 fois au ras d'une planète) ; dans le gaz d'une nébuleuse aussi (1,5 fois dans une pouponnière ou un nuage sombre).
          Mieux vaut s'éloigner un peu avant de sauter.</li>
          <li>En créatif : la préparation seulement, quatre fois plus courte.</li>
        </ul></li>
      <li><b>Comment marche le saut</b> (une technologie imaginaire, appuyée sur une idée de la physique) : rien qui a une masse
      ne peut atteindre la vitesse de la lumière en accélérant. Le réacteur, lui, n'accélère pas la fusée : avec l'énergie
      du nédrolytium, il contracte l'espace devant elle et l'étire derrière (une « bulle de distorsion », comme celle imaginée
      par le physicien Alcubierre en 1994, qui demanderait une énergie que personne ne sait produire). Dans la bulle, la fusée ne bouge
      pas : on ne sent aucune accélération, et <b>le temps n'y ralentit pas</b>, il passe comme celui des étoiles. C'est l'espace autour qui
      file, et lui n'a pas de limite de vitesse. Le temps de référence du jeu est celui de la galaxie : un saut de 7 minutes dure 7 minutes
      pour toi comme pour tout le monde. Le coût selon la masse, la portée et la gêne des puits de gravité et des nébuleuses sont des règles de jeu.</li>
      <li><b>La relativité, hors du saut</b> (elle, bien réelle) : la lumière va à 132 000 blocs par seconde (une année-lumière en un an).
      Plus une fusée s'en approche, plus son temps ralentit par rapport au reste de l'univers : à 87 % de la lumière, 1 seconde pour toi
      en vaut 2 dehors (le jour avance plus vite). Le panneau l'affiche dès que ça compte. Aucune fusée ne l'atteint. Près d'un trou noir, c'est la gravité
      qui ralentit le temps (voir les trous noirs).</li>
      <li>Les flammes des tuyères prennent la couleur du meilleur réacteur armé : orange (classique),
      rouge (renforcé), cyan (nédrolytium-voltite) ; en saut : violet, magenta, bleu électrique.</li>
      <li><kbd>N</kbd> : la liste des repères : les astres du système où tu es (distance, air, gravité, température). ↑ ↓ ou la molette pour choisir, N ou Entrée pour valider.</li>
      <li>Les étoiles du ciel sont toutes de vrais systèmes : plus de 60, de quelques années-lumière à des milliers. Vise une étoile au centre de l'écran,
      appuie sur N : elle est en tête de la liste. Prends-la comme repère, puis le saut (J) t'y emmène tout seul.</li>
      <li>Pour se poser, descends vers un astre solide, à l'endroit que tu veux : on arrive juste
      au-dessus de ce point, sans chargement. À toi d'atterrir !</li>
      <li>Les géantes n'ont pas de sol : sous les nuages, la pression écrase. Trop près de l'étoile,
      on brûle.</li>
    </ul>
    <h3>Sortir, construire n'importe où</h3>
    <ul>
      <li>Lève-toi du poste (<kbd>Maj</kbd>) et sors : on flotte à côté de la fusée, et elle reste à
      côté de nous, car tout tombe ensemble.</li>
      <li><b>En combinaison</b> : <kbd>Z</kbd> <kbd>Q</kbd> <kbd>S</kbd> <kbd>D</kbd> poussent dans la
      direction du regard, <kbd>Espace</kbd> / <kbd>Maj</kbd> vers le haut / le bas, <kbd>Ctrl</kbd>
      pour aller plus vite. On garde son élan, qui s'amortit doucement. Posé contre un bloc, les
      bottes magnétiques tiennent.</li>
      <li>Poser un bloc <b>ancre</b> le coin où l'on est : il ne bouge plus par rapport à son astre.
      On y construit ce qu'on veut : une <b>station</b>, un <b>relais de carburant</b> (des réservoirs
      qu'on remplit au bidon)... Le coin est gardé dans la sauvegarde, avec un repère vert. En s'en
      approchant, on y entre sans coupure.</li>
      <li>Dans les <b>ceintures d'astéroïdes</b>, s'approcher lentement d'un astéroïde : c'est un vrai
      bloc de roche (régolithe, gravier, roches, glace, et des minerais : fer, platine, tungstène,
      fluorite, voltite, charbon), à miner ou à habiter.</li>
      <li><b>En créatif</b> : en volant, monte au-dessus de 456 blocs, sans fusée et sans limite.
      Dans l'espace, <kbd>Ctrl</kbd> tenu en avançant : on file de plus en plus vite.</li>
      <li><b>En ligne</b> : tout le monde peut aller partout, piloter une fusée, monter à bord à
      plusieurs ou se retrouver dans une station. C'est la même partie.</li>
    </ul>
    <h3>Le ciel des planètes</h3>
    <p>Depuis le sol, on voit les autres astres à leur vraie place, avec leurs phases : Hexa en
    grand dans le ciel de la Lune, Orgon qui remplit le ciel de Brasia... (dessinés un peu plus
    grands que nature). Quand l'un passe devant l'étoile, c'est une <b>éclipse</b> : le jour baisse
    et le paysage s'assombrit, jusqu'à la nuit en plein jour si elle est totale.</p>
    <p>Chaque planète est une vraie région de la partie, avec ses propres roches, sables et glaces. Sur les autres planètes : pas d'animaux, pas de météo, et un <b>air
    irrespirable</b> : en survie, il faut porter le <b>casque spatial</b>, sinon on étouffe.</p>
    <h3>Les villageois dans l'espace</h3>
    <ul>
      <li><b>L'air</b> : comme toi, un villageois étouffe là où l'air manque (dans le vide, sur un
      astre sans air, hors d'une salle pressurisée) : il perd de la vie et appelle à l'aide.</li>
      <li><b>Son casque</b> : offre-lui un casque spatial (accroupi + clic droit, le casque en main ;
      un enfant aussi). Il le garde et le met tout seul dès que l'air manque, puis l'enlève quand
      il respire de nouveau. Tes militaires t'accompagnent ainsi sur les autres planètes.</li>
      <li><b>Fonder une colonie</b> : fabrique un <b>kit de colonie</b> (acier, casque spatial,
      établis et coffre : A C A / E K E / A A A, A acier, C casque, E établi, K coffre) et utilise-le (clic droit) sur le sol d'un autre
      astre. Une place d'acier, une mairie et quatre maisons d'acier sortent du sol, chacune avec
      son établi et son coffre ; la mairie est garnie (bois, pierre, verre, pain et 4 casques). Tes
      militaires à moins de 32 blocs s'y installent comme colons ; sinon deux colons arrivent avec
      le kit. Tous sont casqués, et les enfants qui y naissent aussi. Ensuite, la colonie vit et
      grandit comme un village (il faut au moins 64 blocs entre deux villages).</li>
      <li><b>Les métiers de l'espace</b> (sur un autre astre) : l'<b>astronaute</b> (toujours casqué)
      va chercher les casques rangés à la mairie et les porte aux habitants qui n'en ont pas. Dès 3
      adultes, le <b>technicien</b> rebouche avec une plaque d'acier les brèches des salles
      pressurisées proches. Dès 4 adultes, le <b>commerçant spatial</b> vend des bidons de
      carburant et du tungstène, et rachète le nédrolytium.</li>
    </ul>`],
  ['multi', 'Multijoueur', `
    <ul>
      <li>Menu du jeu &gt; <b>Ouvrir en multijoueur</b> : ta partie devient un serveur (10 joueurs
      au plus). Tu obtiens un <b>code</b> à donner à tes amis.</li>
      <li>Les autres joueurs : Multijoueur &gt; entrer le code (ou l'adresse).</li>
      <li><kbd>T</kbd> ou <kbd>Entrée</kbd> : le chat. <kbd>Tab</kbd> : la liste des joueurs.</li>
      <li>L'hôte peut expulser un joueur (<code>/kick</code>) et lui seul change la météo.</li>
      <li><b>PvP</b> : en survie, les joueurs peuvent se frapper (clic gauche sur un joueur). Les
      dégâts dépendent de l'arme, comme sur les animaux. L'hôte l'active ou le coupe avec
      <code>/pvp on</code> / <code>/pvp off</code> (activé au départ).</li>
      <li><b>Coffres et fours</b> : partagés entre tous les joueurs. Si deux joueurs ouvrent le
      même coffre, chacun voit ce que l'autre y met ; un four cuit chez tout le monde.</li>
      <li>La <b>carte du monde</b> montre les autres joueurs (flèche de couleur et pseudo).</li>
      <li><b>Carte à explorer</b> : en survie, la carte de ton monde ne montre que les endroits où tu
      es passé (plus loin quand tu es en hauteur) ; le reste est dans le brouillard. En créatif, tout
      est visible.</li>
      <li><b>Carte de la galaxie</b> : dans l'espace, la carte du monde devient celle de la galaxie,
      en 3D : Andromède autour d'Hexa, la Voie lactée quand on y est. Le « tu es ici » qui pulse, le centre (M31* ou Sagittarius A*), les bras spiraux et les nébuleuses,
      les systèmes visités et le chemin suivi de l'un à l'autre. Sous la carte : dans quel bras tu es, à
      quelle distance du centre, au-dessus ou au-dessous du plan, et à quelle distance d'Hexa. Glisser
      pour tourner, clic droit pour se déplacer, molette pour zoomer (deux doigts sur tablette), double
      clic sur un nom pour aller le voir.</li>
      <li><b>Repères</b> : clic droit sur la carte (dans ton monde) pour poser un repère nommé ; clic
      sur un repère pour le retirer. Ils sont gardés avec le monde et partagés avec tous les joueurs.</li>
      <li><b>Chat vocal de proximité</b> : maintiens <kbd>B</kbd> pour parler. On entend les joueurs
      à moins de 40 blocs, plus fort quand ils sont près et du côté où ils sont ; un haut-parleur
      s'affiche au-dessus de celui qui parle. Options &gt; Sons : « Toujours actif » (le micro
      transmet dès que tu parles), « Désactivé », et le volume des voix.</li>
      <li>Le multijoueur marche dans l'application (pas dans un navigateur).</li>
    </ul>`],
  ['compte', 'Compte en ligne', `
    <ul>
      <li>Écran titre ou menu du jeu &gt; <b>Compte</b> : crée un compte (e-mail, mot de passe,
      pseudo) ou connecte-toi. Ton pseudo de compte devient aussi ton pseudo en multijoueur.</li>
      <li><b>Succès</b> : débloqués en jouant, en survie seulement, ils donnent de l'XP. Dès qu'un monde
      passe en créatif, les succès y sont désactivés pour toujours (même revenu en survie).</li>
      <li><b>Niveau</b> : l'XP (succès, codes cadeaux) fait monter de niveau et débloque des
      <b>couleurs de pseudo</b>, visibles au-dessus de ta tête en multijoueur.</li>
      <li><b>Capes</b> : une cape par niveau, du 1 au 45, en mosaïque d'hexagones. Par paliers de 5
      niveaux, la matière change : bois, feuillage, pierre, fer, voltite, platine, fluorite,
      cramoisite, or. Dans chaque palier, la cape est d'abord unie, puis bordée, à bandes, à
      emblème, et enfin royale. Les pastilles du bas donnent le rang dans le palier. Tu peux porter
      la cape de ton niveau et toutes celles en dessous. Choisis-la sur l'écran titre, sous la skin
      (flèches ◀ ▶). Les administrateurs ont la <b>cape galaxie</b>, un ciel étoilé qui défile. Les
      autres joueurs voient ta cape en multijoueur ; elle se soulève quand tu marches.</li>
      <li><b>Capes de champion</b> : le N°1 de chaque classement (égalités comprises) porte la cape de
      sa catégorie, bordée d'or : trophée (succès), cœur qui bat (survie en cours), cœur couronné
      (record de survie), sablier (temps de jeu), réseau ferré, pyramide de blocs (blocs posés),
      pioche (blocs cassés), locomotive (distance en train), traces de pas (à pied) et blason (le
      clan premier, pour tous ses membres). Elle s'en va si tu n'es plus premier.</li>
      <li><b>Capes offertes</b> : Fondateur, Amitié, Étoile et Industry (bordées d'argent) ne
      s'obtiennent qu'en cadeau d'un administrateur.</li>
      <li><b>Codes cadeaux</b> : à taper dans l'écran Compte.</li>
      <li>Les objets gagnés attendent dans la <b>boîte à récompenses</b> et se récupèrent dans un
      monde en survie (menu du jeu &gt; Compte &gt; Récupérer).</li>
    </ul>`],
  ['sons', 'Sons et réglages', `
    <ul>
      <li>Options &gt; <b>Sons…</b> : volume général et volume de chaque type de son (effets,
      météo, ambiance).</li>
      <li>Options : champ de vision, sensibilité, distance d'affichage, résolution, qualité
      graphique, ombres, images par seconde.</li>
      <li>Fenêtre réduite : le jeu se tait.</li>
    </ul>`],
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export class Wiki {
  // data : { BLOCKS, ITEMS, RECIPES, SMELT, FUEL, COMMANDS, BIOME_NAMES, BIOME_COLORS,
  //          icon(id, size) -> canvas, controls (élément <dl> des commandes) }
  constructor(data) {
    this.d = data;
    this.nav = document.getElementById('wiki-nav');
    this.page = document.getElementById('wiki-page');
    this.search = document.getElementById('wiki-search');
    this.built = false;
    this.current = 'bases';
  }

  open() {
    if (!this.built) this.build();
    this.search.value = '';
    this.show(this.current);
  }

  // Liste des pages (écrites, puis tirées du jeu)
  build() {
    this.built = true;
    this.pages = [
      ...PAGES.slice(0, 1),
      ['touches', 'Touches', () => this.d.controls.outerHTML],
      ...PAGES.slice(1),
      ['recettes', 'Fabrication', () => this.recipesHtml()],
      ['four', 'Four', () => this.furnaceHtml()],
      ['blocs', 'Blocs et objets', () => this.catalogHtml()],
      ['biomes', 'Biomes', () => this.biomesHtml()],
      ['commandes', 'Commandes du chat', () => this.commandsHtml()],
    ];
    this.nav.innerHTML = this.pages.map(([id, title]) => `<button data-page="${id}">${esc(title)}</button>`).join('');
    this.nav.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-page]');
      if (!b) return;
      this.search.value = '';
      this.show(b.dataset.page);
    });
    this.search.addEventListener('input', () => (this.search.value.trim() ? this.find(this.search.value.trim()) : this.show(this.current)));
    this.search.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
    // liens d'une page vers une autre
    this.page.addEventListener('click', (e) => {
      const a = e.target.closest('[data-goto]');
      if (a) { this.search.value = ''; this.show(a.dataset.goto); }
    });
  }

  html(id) {
    const p = this.pages.find((x) => x[0] === id);
    if (!p) return '';
    return typeof p[2] === 'function' ? p[2]() : p[2];
  }

  show(id) {
    this.current = id;
    const p = this.pages.find((x) => x[0] === id) || this.pages[0];
    for (const b of this.nav.children) b.classList.toggle('on', b.dataset.page === p[0]);
    this.page.innerHTML = `<h2>${esc(p[1])}</h2>` + this.html(p[0]);
    this.fillIcons();
    this.page.scrollTop = 0;
  }

  // Les icônes sont des <i data-icon="id"> remplacées par une image du bloc ou de l'objet
  fillIcons() {
    for (const el of this.page.querySelectorAll('i[data-icon]')) {
      const src = this.d.icon(+el.dataset.icon, 64);
      if (!src) continue;
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      c.getContext('2d').drawImage(src, 0, 0, 64, 64);
      c.className = 'wiki-icon';
      c.title = this.name(+el.dataset.icon);
      el.replaceWith(c);
    }
  }

  name(id) {
    return this.d.BLOCKS[id]?.name || this.d.ITEMS[id]?.name || '?';
  }

  icon(id) {
    return `<i data-icon="${id}"></i>`;
  }

  // Une recette : la grille (motif) et le résultat
  recipeHtml(r) {
    const rows = r.p.length, cols = Math.max(...r.p.map((l) => l.length));
    let grid = '';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const ch = r.p[y][x];
        grid += `<span class="cell">${ch && ch !== '.' && r.k[ch] !== undefined ? this.icon(r.k[ch]) : ''}</span>`;
      }
    }
    const [out, n] = r.out;
    return `<div class="wiki-recipe"><div class="grid" style="grid-template-columns:repeat(${cols},34px)">${grid}</div>
      <span class="arrow">→</span><span class="cell out">${this.icon(out)}${n > 1 ? `<b>${n}</b>` : ''}</span>
      <span class="label">${esc(this.name(out))}</span></div>`;
  }

  recipesHtml(list = this.d.RECIPES) {
    return `<p>Dans l'inventaire (grille 2x2) ou sur une table de craft (grille 3x3). Le motif peut
      être placé n'importe où dans la grille, et retourné de gauche à droite.</p>
      <p><b>À la main :</b> devant une table de craft, un four ou un coffre, on se penche dessus et on
      y pose les objets soi-même : la grille est tracée sur le plateau de la table (clic sur l'objet
      posé à côté pour le fabriquer), le four prend ce qui cuit par l'ouverture du dessus et le
      combustible dans son foyer (ce qui est cuit attend sur le rebord), le coffre s'ouvre et on range
      dedans. Clic gauche : prendre / poser ; clic droit : un seul objet (en glissant : un par case) ;
      Maj : ranger d'un coup ; Tab : la fenêtre classique. (Options : « Artisanat à la main ».)
      Les objets posés sont de vrais objets en 3D. Le <b>carnet</b>, à gauche, montre les recettes
      (celles qu'on peut faire d'abord) : en survolant une recette, des fantômes montrent où poser
      chaque objet sur la table ; clic : tout poser, Maj : tout fabriquer, clic droit : garder le
      guide pendant qu'on pose soi-même (une case fausse rougit). Au four, il propose ce qu'on peut
      cuire et de quoi le chauffer.</p>
      <div class="wiki-recipes">${list.map((r) => this.recipeHtml(r)).join('')}</div>`;
  }

  furnaceHtml() {
    const smelt = Object.entries(this.d.SMELT).map(([a, b]) =>
      `<div class="wiki-recipe">${this.icon(+a)}<span class="arrow">→</span>${this.icon(b)}<span class="label">${esc(this.name(+a))} → ${esc(this.name(b))}</span></div>`).join('');
    const fuel = Object.entries(this.d.FUEL).map(([a, s]) =>
      `<div class="wiki-recipe">${this.icon(+a)}<span class="label">${esc(this.name(+a))} : ${s} s (${Math.round(s / 5 * 10) / 10} objet${s / 5 >= 2 ? 's' : ''})</span></div>`).join('');
    return `<p>Mets ce qu'il faut fondre en haut, un combustible en bas. Un objet fond en 5 secondes.</p>
      <h3>Ce qu'on fond</h3><div class="wiki-recipes">${smelt}</div>
      <h3>Combustibles</h3><div class="wiki-recipes">${fuel}</div>`;
  }

  // Tous les blocs et objets visibles dans l'inventaire créatif
  entries() {
    const out = [];
    for (const [id, b] of Object.entries(this.d.BLOCKS)) if (!b.hidden && +id) out.push(+id);
    for (const [id, it] of Object.entries(this.d.ITEMS)) if (!it.hidden) out.push(+id);
    return out;
  }

  catalogHtml(ids = this.entries()) {
    const how = (id) => {
      const r = this.d.RECIPES.find((x) => x.out[0] === id);
      const f = Object.entries(this.d.SMELT).find(([, b]) => b === id);
      const tier = this.d.ITEMS[id]?.tier;
      return [r ? 'se fabrique' : '', f ? 'au four' : '', tier ? `outil de palier ${tier}` : ''].filter(Boolean).join(', ');
    };
    return `<p>${ids.length} blocs et objets. Clique sur « Fabrication » pour les recettes.</p>
      <div class="wiki-catalog">${ids.map((id) => `<div class="wiki-entry">${this.icon(id)}<span>${esc(this.name(id))}<small>${esc(how(id))}</small></span></div>`).join('')}</div>`;
  }

  biomesHtml() {
    return `<div class="wiki-catalog">${this.d.BIOME_NAMES.map((n, i) =>
      `<div class="wiki-entry"><i class="swatch" style="background:rgb(${this.d.BIOME_COLORS[i].join(',')})"></i><span>${esc(n)}</span></div>`).join('')}</div>
      <p>Les couleurs sont celles de la carte du monde.</p>`;
  }

  commandsHtml() {
    return `<p>Tape <kbd>T</kbd> ou <kbd>Entrée</kbd> puis la commande. <code>/help</code> les liste aussi dans le chat.</p>
      <table class="wiki-table">${this.d.COMMANDS.map(([c, d, w]) =>
      `<tr><td><code>${esc(c)}</code></td><td>${esc(d)}${w === 'mp' ? ' (multijoueur)' : w === 'host' ? ' (hôte)' : ''}</td></tr>`).join('')}</table>`;
  }

  // Recherche : pages dont le texte contient les mots, blocs et objets, recettes
  find(query) {
    const words = fold(query).split(/\s+/).filter(Boolean);
    const match = (text) => { const t = fold(text); return words.every((w) => t.includes(w)); };
    const pages = this.pages.filter(([id, title, h]) => typeof h !== 'function' && match(title + ' ' + plain(h)));
    const ids = this.entries().filter((id) => match(this.name(id)));
    const recipes = this.d.RECIPES.filter((r) => match(this.name(r.out[0])));
    let html = `<h2>Recherche : « ${esc(query)} »</h2>`;
    if (pages.length) {
      html += '<h3>Pages</h3><ul class="wiki-results">' + pages.map(([id, title, h]) => {
        const t = plain(h), i = fold(t).indexOf(words[0]);
        const snip = i >= 0 ? '…' + t.slice(Math.max(0, i - 50), i + 90) + '…' : '';
        return `<li><a data-goto="${id}">${esc(title)}</a><small>${esc(snip)}</small></li>`;
      }).join('') + '</ul>';
    }
    if (ids.length) html += '<h3>Blocs et objets</h3>' + this.catalogHtml(ids).replace(/^<p>.*?<\/p>/s, '');
    if (recipes.length) html += '<h3>Recettes</h3><div class="wiki-recipes">' + recipes.map((r) => this.recipeHtml(r)).join('') + '</div>';
    if (!pages.length && !ids.length && !recipes.length) html += '<p>Rien trouvé.</p>';
    this.page.innerHTML = html;
    for (const b of this.nav.children) b.classList.remove('on');
    this.fillIcons();
  }
}
