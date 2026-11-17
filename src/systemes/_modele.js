// =====================================================================================================
//  MODÈLE D'UN SYSTÈME STELLAIRE : tous les paramètres possibles, expliqués.
//  1. Copie ce fichier dans src/systemes/ sous un autre nom (ex. : mon-systeme.js).
//  2. Ajoute-le dans src/systemes/index.js (import + dans la liste SYSTEMES).
//  Le plus simple : lancer-atelier.bat, puis « + Nouveau système » : tout se règle dans l'atelier.
//  À la main : 3. Regarde-le dans l'atelier : lancer-atelier.bat (http://localhost:8090/outils/atelier-systemes.html).
//     Après chaque changement : Ctrl+R dans l'atelier. Les erreurs y sont écrites en rouge.
//  4. En jeu (mode créatif) : /astre <nom de la planète> pour aller sur son sol.
//
//  Seuls les paramètres marqués (OBLIGATOIRE) le sont : tout le reste a une valeur par défaut,
//  calculée quand c'est possible (période des orbites, gravité, température...).
//  Les ids : minuscules, chiffres et tirets, uniques dans tout l'univers. Une fois qu'un monde a
//  visité une planète, ne change plus son id (son nom, si : il n'est qu'affiché).
//  Les couleurs : '#rrggbb', '#rgb', 'rgb(r, g, b)', ou un nom : blanc, noir, rouge, orange, jaune,
//  vert, bleu, cyan, turquoise, violet, pourpre, rose, magenta, marron, gris, or, argent, indigo,
//  emeraude, 'rouge neutron', 'bleu glacier', 'vert acide', 'violet profond', 'blanc bleute'.
//  Les blocs : leur nom exact dans le jeu (« Basalte », « Minerai de fer », « Sable ocre »...,
//  majuscules et accents comptent pas) ou leur numéro. Raccourcis : 'eau', 'lave', 'eau glaciale'.
//  Les unités : UA = distance d'Hexa à son étoile ; al = année-lumière ; taille d'une planète en
//  rayons d'Hexa (1 = 14 000 blocs) ; taille d'une étoile en rayons de l'étoile Hexa ; jours = jours
//  de jeu (une année d'Hexa : 120 jours).
// =====================================================================================================
export default {
  id: 'mon-systeme',                     // (OBLIGATOIRE)
  nom: 'Mon système',
  actif: false,                          // false : seulement dans l'atelier (un brouillon) ; true : dans le jeu
  description: 'Ce qu\'on en dit.',

  // Où il est dans l'univers, vu d'Hexa (les autres : Pipiens 7,7 al, Érèbe 24,8, Ethan 30, PXT 45)
  position: { distance: 20, direction: 90, hauteur: 0 }, // al ; degrés (0 à 360) ; degrés (-90 à 90)
  // ou : position: { x: 12, y: 0, z: -15 },            // en années-lumière, Hexa au centre

  // ---------------------------------------------------------------------------------------------
  // LES ÉTOILES (OBLIGATOIRE : au moins une). La première est le centre du système.
  // type : 'naine-jaune' (comme Hexa), 'naine-orange', 'naine-rouge', 'naine-blanche', 'blanche',
  //        'geante-bleue', 'geante-rouge', 'neutrons', 'pulsar' (avec faisceaux), 'magnetar',
  //        'trou-noir'. Le type donne tout ; chaque paramètre ci-dessous le remplace.
  // ---------------------------------------------------------------------------------------------
  etoiles: [
    {
      id: 'mon-etoile',                  // (OBLIGATOIRE)
      nom: 'Mon étoile',
      type: 'naine-jaune',
      taille: 1,                         // en rayons de l'étoile Hexa (neutrons : 0,04 ; géante rouge : 25)
      masse: 1,                          // en masses d'Hexa (règle les orbites : période de Kepler)
      couleur: '#fff1d0',                // la couleur de l'étoile (n'importe laquelle : violet, vert...)
      couronne: '#ffb048',               // la couleur de son halo
      eclat: 1,                          // sa lumière comparée à Hexa (température des planètes, panneaux solaires)
      lumiereAuSol: 1,                   // la part de lumière au sol de ses planètes (1 : plein jour ; 0,3 : pénombre)
      temperature: 5800,                 // en kelvins (affichée seulement)
      inclinaison: 0,                    // degrés
      description: 'Ce qu\'on en dit.',
      // pulsar / neutrons / magnetar :
      // faisceaux: true, couleurFaisceaux: '#4f8cff',
      // trou-noir :
      // couleurDisque: '#ff60ff',       // la couleur de son disque (sinon : orange et blanc, comme Érèbe)
    },
    // Une deuxième étoile : autour de la première (ou d'une autre déjà déclarée)
    // {
    //   id: 'mon-etoile-b', type: 'naine-rouge',
    //   orbite: {
    //     autour: 'mon-etoile',         // (par défaut : la première)
    //     distance: 0.2,                // en UA (OBLIGATOIRE)
    //     excentricite: 0.1,            // 0 : un cercle ; jusqu'à 0,95 : un ovale allongé
    //     inclinaison: 30,              // l'inclinaison de son orbite, en degrés (sinon : presque à plat)
    //     noeud: 0,                     // la direction (degrés) où son orbite monte le plus haut
    //     periode: 20,                  // en jours (sinon : calculée)
    //     barycentre: true,             // les deux tournent ensemble autour de leur centre commun
    //   },
    // },
  ],

  // ---------------------------------------------------------------------------------------------
  // LES PLANÈTES ET LES LUNES (dans l'ordre : un astre avant ses lunes)
  // ---------------------------------------------------------------------------------------------
  planetes: [
    {
      id: 'ma-planete',                  // (OBLIGATOIRE)
      nom: 'Ma planète',
      type: 'rocheuse',                  // 'rocheuse', 'naine', 'lune', 'geante-gazeuse', 'geante-glace'
      autour: 'mon-etoile',              // une étoile, une planète (c'est alors une lune), ou 'centre'
                                         // (autour des deux étoiles d'un couple : barycentre: true)
      distance: 1,                       // (OBLIGATOIRE) en UA autour d'une étoile ; en rayons de la planète pour une lune
      excentricite: 0,                   // 0 à 0,95
      inclinaisonOrbite: undefined,      // l'inclinaison de son orbite, en degrés : 0 à plat, 90 en passant
                                         // par les pôles, plus de 90 : elle tourne à l'envers (sinon : presque à plat)
      noeudOrbite: 0,                    // la direction (degrés, 0 à 360) où son orbite monte le plus haut
      periode: undefined,                // en jours (sinon : calculée, Kepler)
      taille: 1,                         // en rayons d'Hexa (1 = 14 000 blocs ; la Lune d'Hexa : 0,27)
      jour: 1,                           // la durée de son jour, en jours de jeu
      synchrone: false,                  // true : elle montre toujours la même face à son astre (face brûlante, face gelée)
      inclinaison: 10,                   // l'inclinaison de son axe, en degrés
      gravite: 1,                        // 1 : comme Hexa (sinon : selon sa taille)
      temperature: 15,                   // °C moyens (sinon : selon l'éclat de l'étoile et la distance)
      aurores: false,                    // des aurores dans son ciel
      nuages: true,                      // false : jamais de nuages vus de l'espace
      description: 'Ce qu\'on en dit.',
      zone: undefined,                   // (avancé) sa place sur la carte du jeu, de 40 à 169 (sinon : tirée de son id)

      // Son air (sans : le vide, ciel noir)
      atmosphere: {
        respirable: true,
        ciel: '#4a8ad8',                 // le ciel le jour
        horizon: '#b8daf4',              // (sinon : le ciel, éclairci)
        densite: 1,                      // 0 : le vide ; 1 : comme Hexa ; 3 : très épais (freine, chauffe à l'entrée)
        bord: '#78b8ff',                 // le liseré lumineux vu de l'espace
      },
      // Ses couleurs vues de l'espace (sinon : celles de ses biomes)
      couleurs: { bas: '#2a6ab0', milieu: '#4a8a3a', haut: '#7a7064', sommet: '#f0f4f8', mer: '#2a62a8' },
      // Ses anneaux (en rayons de la planète)
      anneaux: [{ de: 1.4, a: 1.8, opacite: 0.5 }],
      couleurAnneaux: '#c8e0ea',
      // Géantes seulement : leurs bandes (de haut en bas, autant qu'on veut) et leur grande tache
      // bandes: ['#c98a4b', '#e2b884', '#a0623a'], tache: '#b5442c',

      // -------------------------------------------------------------------------------------------
      // SON SOL (pas pour les géantes). Deux façons :
      //  - un style déjà fait, avec ses propres blocs :
      //    terrain: { style: 'mars', base: 62, relief: 30, dessus: 'Sable ocre', dessous: '...', roche: '...',
      //               profond: '...', mer: { niveau: 50, liquide: 'lave' }, minerais: [...] }
      //    styles : moon, mars, desert, sandstone, volcanic, ironworld, io, europa, glacier, redice,
      //    pluto, twilight (pour une planète synchrone), frozenocean, eldra, glacyon, cinder, voss,
      //    halo, tessel, perse, lethe ;
      //  - des biomes, tout en paramètres (ci-dessous).
      // -------------------------------------------------------------------------------------------
      terrain: {
        style: 'biomes',
        base: 62,                        // la hauteur moyenne du sol (le monde va de 0 à 155)
        relief: 24,                      // l'amplitude des collines et des vallées
        continents: 1800,                // la taille des grandes formes, en blocs (petit : îles ; grand : continents)
        rugosite: 0.5,                   // le détail à l'échelle du joueur (0 : lisse ; 1 : très accidenté)
        mer: {
          niveau: 56,                    // sans mer : enlève « mer » (ou liquide: 'aucun')
          liquide: 'eau',                // 'eau', 'lave', 'eau glaciale', ou n'importe quel bloc
          gel: 'Glace',                  // la mer gèle en surface sous gelSous °C (false : jamais)
          gelSous: 0,
          plage: 'Sable',                // ou { bloc: 'Gravier', largeur: 3 } ; false : pas de plage
          fond: 'Sable',
        },
        montagnes: { force: 0.5, taille: 900, hauteur: 40 },       // force 0 : aucune
        crateres: { densite: 0, taille: 30 },                       // densite 0 à 1
        canyons: { densite: 0, profondeur: 24, largeur: 1 },
        volcans: { densite: 0, hauteur: 40, taille: 120, lave: 'lave' }, // lave: false : sans lac au sommet
        plateaux: { densite: 0, hauteur: 14, marches: 4 },          // en gradins de « marches » blocs
        dunes: { hauteur: 6, longueur: 30 },                        // pour les biomes avec dunes: true
        // Le climat (il choisit les biomes)
        temperature: 15,                 // °C moyens (sinon : celle de la planète)
        ecartPoles: 40,                  // de combien les pôles sont plus froids que l'équateur
        froidAltitude: 0.6,              // °C perdus par bloc au-dessus de la mer
        humidite: 0.5,                   // 0 : sec partout ; 1 : humide partout
        // Sous le sol
        roche: 'Pierre',
        profond: 'Basalte',              // sous la hauteur 0
        strates: ['Pierre', 'Ardoise', 'Pierre', 'Diorite'],        // ce que montrent les falaises
        epaisseurStrates: 2,
        grottes: true,
        minerais: [
          { bloc: 'Minerai de fer', frequence: 0.012, profondeurMax: 60 }, // frequence : 0 à 0,2 ; jusqu'à quelle hauteur
        ],
        // Les biomes : chacun là où ses conditions conviennent ; si plusieurs conviennent, le DERNIER
        // de la liste l'emporte (mets les cas particuliers, comme les sommets, à la fin). Là où aucun
        // ne convient : le plus proche. Aux frontières, ils se mélangent par petites touches.
        biomes: [
          {
            nom: 'Forêt',
            couleur: '#3a6a2a',          // sa couleur vue de l'espace et sur la carte de l'atelier
            conditions: {
              temperature: [5, 25],      // °C
              humidite: [0.5, 1],        // 0 à 1
              altitude: [0, 30],         // blocs au-dessus de la mer
              latitude: [0, 0.7],        // 0 : équateur ; 1 : pôles
            },
            dessus: 'Herbe',
            dessous: 'Terre',
            epaisseur: 3,                // l'épaisseur du dessous
            arbres: { densite: 0.5, tronc: 'Bûche de chêne', feuilles: 'Feuilles de chêne', hauteur: [4, 7], couronne: 2, espacement: 5 },
            plantes: [{ bloc: 'Herbe haute', densite: 0.1 }],       // une plante posée sur le sol
            formations: [                                           // rochers, aiguilles, colonnes
              { bloc: 'Pierre', tete: 'Mousse violette', densite: 0.05, hauteur: [2, 4], largeur: 1.2, espacement: 14 },
            ],
            dunes: false,                // des dunes (voir terrain.dunes)
          },
          { nom: 'Sommets', couleur: '#f0f4f8', conditions: { altitude: [35, 999] }, dessus: 'Neige', dessous: 'Pierre' },
        ],
      },
    },
  ],
};
