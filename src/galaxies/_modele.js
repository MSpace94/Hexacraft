// =====================================================================================================
//  MODÈLE D'UNE GALAXIE : tous les paramètres possibles, expliqués.
//  Le plus simple : lancer-atelier.bat, vue Galaxies, « + Nouvelle galaxie » : tout se règle dans l'atelier.
//  À la main : copie ce fichier dans src/galaxies/ (ex. : ma-galaxie.js), puis ajoute-le dans
//  src/galaxies/index.js (import + dans la liste GALAXIES).
//
//  Une galaxie, c'est un catalogue d'étoiles tiré au chargement (comme la Voie lactée et Andromède,
//  voir galaxie.js) : chacune est un système complet (étoile, compagne, un monde où se poser), fabriqué
//  seulement quand on s'en approche. Aucune limite de distance : les positions sont comptées depuis le
//  système où l'on est, précises au bloc près même à des milliards d'années-lumière.
//  Une fois qu'un monde a visité une de ses étoiles, ne change plus id, graine, ni le nombre d'étoiles
//  (les systèmes seraient tirés autrement).
// =====================================================================================================
export default {
  id: 'ma-galaxie',                // (OBLIGATOIRE) minuscules, chiffres, tirets
  nom: 'Ma galaxie',
  actif: false,                    // false : seulement dans l'atelier (un brouillon) ; true : dans le jeu
  description: 'Ce qu\'on en dit.',

  // Où est son centre, vu d'Hexa : années-lumière ; degrés (0 à 360) ; degrés (-90 à 90).
  // Ou { x, y, z } en années-lumière. (Andromède : 2,5 millions d'al ; aucune limite)
  position: { distance: 5000000, direction: 40, hauteur: 10 },

  // spirale, barree (une barre au centre et deux bras), elliptique, lenticulaire (un disque sans
  // bras), irreguliere (des nuages d'étoiles)
  type: 'spirale',
  rayon: 50000,                    // al : le rayon du disque (la Voie lactée : ~50 000)
  etoiles: 20000,                  // systèmes (200 à 100 000)
  bras: 4,                         // (spirale) 2 à 8
  enroulement: 12,                 // (spirale, barree) degrés : l'angle des bras (petit : bien enroulés)
  epaisseur: 1000,                 // al : l'épaisseur du disque
  bulbe: 0.2,                      // part des étoiles dans le bulbe du centre (0 à 0,8)
  inclinaison: 30,                 // degrés : le disque penché par rapport au plan du jeu
  orientation: 0,                  // degrés : vers où il penche
  trouNoir: true,                  // un trou noir géant au centre
  graine: 1,                       // le tirage des étoiles
};
