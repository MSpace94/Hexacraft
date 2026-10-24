// Wiki du jeu : tout ce qu'il faut savoir, consultable en jouant (menu du jeu > Wiki).
// Les pages d'explications sont écrites ici ; les listes (recettes, four, blocs et objets,
// biomes, commandes) sont tirées des données du jeu : elles restent à jour toutes seules.
// Une recherche parcourt tout (textes, noms des blocs et objets, recettes).

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
    </ul>`],
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
  ['outils', 'Outils et minerais', `
    <h3>Les paliers d'outils</h3>
    <p>Chaque palier casse plus vite et permet de récolter de meilleurs minerais :</p>
    <ol>
      <li><b>Bois</b> : le premier outil. Une pioche en bois ne détache de la pierre que des cailloux.</li>
      <li><b>Rustique</b> (cailloux) : récupère la pierre taillée.</li>
      <li><b>Pierre</b> : récolte le <b>fer</b> et la <b>voltite impure</b>.</li>
      <li><b>Fer</b> : récolte la <b>voltite</b>, la <b>fluorite</b> et l'<b>obsidienne</b>.</li>
      <li><b>Fluorite</b> : récolte le <b>platine</b>.</li>
      <li><b>Platine</b> : récolte le <b>tungstène</b>.</li>
      <li><b>Tungstène</b> : récolte la <b>cramoisite</b>.</li>
      <li><b>Cramoisite</b> : le plus rapide.</li>
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
      <tr><td>Bois, châtaignier, tilleul</td><td>60</td></tr>
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
    </table>
    <p>Au-dessus de 0, les endroits déjà visités avant une mise à jour gardent leurs anciens minerais.</p>`],
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
    </ul>`],
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
    <h3>Zombies</h3>
    <p>La nuit, des zombies sortent loin des joueurs (jamais dans un village). Ils poursuivent les
    joueurs en survie et les villageois, bras tendus, et mordent (un cœur et demi par morsure).
    Les villageois s'enfuient en criant quand ils en voient un. Au lever du jour, les zombies
    restés sous le ciel brûlent peu à peu ; à l'abri (grotte, maison), ils survivent. Ils ont
    10 cœurs et ne laissent rien.</p>
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
    <p>Un œuf par animal (cochon, moutons, renard, lièvre, villageois, zombie), dans l'inventaire du
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
    plante une pomme de terre (clic droit sur le dessus de la terre labourée). Elles poussent toutes
    seules. Le blé mûr donne du blé et 1 à 3 graines (3 blés font un pain) ; les pommes de terre
    mûres en donnent 2 à 4, à manger crues ou cuites au four. Dans les villages, les fermiers cultivent
    les champs : du blé et des pommes de terre, une case sur deux ; la récolte va au boulanger
    (ou au coffre de la mairie) et nourrit le village.</p>`],
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
    </ul>
    <h3>Changer la météo</h3>
    <ul>
      <li><code>/weather 1</code> à <code>/weather 5</code> : une dépression (nuages, pluie, orages)
      se forme en moins d'une minute à cet endroit et dérive avec le vent (environ 15 minutes).</li>
      <li><code>/weather -1</code> à <code>/weather -5</code> : un anticyclone (beau temps).</li>
      <li><code>/weather tornade</code> : tempête en quelques secondes, et une tornade qui arrive.</li>
      <li><code>/weather</code> : le temps qu'il fait ici. <code>/weather reset</code> : retour au temps naturel.</li>
    </ul>
    <p>Carte du monde : la case « Météo (pluie) » montre la pluie, les orages et les tornades
    comme un radar.</p>`],
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
      <li>On entend les oiseaux le jour et les grillons la nuit dans les plaines et les forêts, et
      le feu des torches de près.</li>
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
