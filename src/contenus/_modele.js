// =====================================================================================================
//  MODÈLE D'UN CONTENU AJOUTÉ (bloc, objet, minerai, machine, nourriture, outil, arme, réservoir)
//  Le plus simple : lancer-atelier-contenus.bat, puis « + Nouveau » : tout se règle dans l'atelier
//  (images dessinées ou importées, propriétés, recette, code).
//  À la main : copie ce fichier dans src/contenus/ (ex. : cristal-bleu.js), dessine ses images dans
//  texture/contenus/cristal-bleu/ (haut.png, cote.png, bas.png pour un bloc ; icone.png pour un
//  objet), puis ajoute-le dans src/contenus/index.js.
//
//  Les objets du jeu se désignent par leur numéro (voir l'atelier : il les cherche par leur nom),
//  les autres contenus par leur clé ('cristal-bleu').
// =====================================================================================================
export default {
  cle: 'mon-contenu',        // (OBLIGATOIRE) minuscules, chiffres et tirets ; ne plus la changer
  num: 12000,                // (OBLIGATOIRE) 12000 à 16383, unique ; donné par l'atelier, ne plus le changer
  actif: true,               // false : un brouillon (seulement dans l'atelier)
  type: 'bloc',              // bloc, minerai, machine, reservoir, objet, nourriture, outil, arme
  nom: 'Mon contenu',

  // ---- bloc, minerai, machine, réservoir ----
  faces: { haut: true, bas: false }, // images à part pour le dessus / le dessous (sinon : celle du côté)
  solide: true,              // false : on le traverse
  transparent: false,        // comme du verre (on voit les blocs derrière)
  lumiere: 0,                // 0 à 15
  ressort: false,            // on rebondit dessus
  incassable: false,
  durete: 'stone',           // dirt, stone, wood, leaves, glass, obsidian, hard, instant, wool
  pioche: false,             // il faut une pioche pour qu'il donne quelque chose
  donne: null,               // ce qu'il donne cassé : [objet, nombre] (sinon : lui-même)
  explosif: null,            // { puissance: 1 (une TNT) à 1000, meche: 4 (secondes) } : s'allume au briquet / à la torche
  combustible: 0,            // secondes de feu dans un four, une chaudière
  four: null,                // ce qu'il devient cuit au four (un objet)
  // minerai : où il se forme (Y de... à... ; chance : part des zones de 6 x 6 x 6 qui ont un filon)
  gen: { de: 5, a: 40, chance: 0.1 },
  // machine : watts, secondes par objet, recettes [entrée, sortie, nombre]
  machine: { watts: 20, temps: 4, recettes: [[3, 28, 1]] },
  reservoir: 8000,           // réservoir : capacité en mB

  // ---- objets ----
  pile: 64,                  // nombre par case
  nourriture: 4,             // nourriture : points de faim rendus (une cuisse : 3, un steak : 8)
  outil: { sorte: 'pickaxe', niveau: 3 }, // outil, arme : pickaxe, axe, shovel, sword, hoe ; niveau 1 (bois) à 8
  degats: 6,                 // arme : dégâts d'un coup

  // ---- recette d'établi (grille de 1 à 3 lignes, '.' : case vide) ----
  recette: { grille: ['AAA', '.B.'], cles: { A: 3, B: 'mon-autre-contenu' }, donne: 1 },

  // ---- code personnalisé : jeu (l'API, voir src/contenus-api.js), e (l'événement) ----
  code: {
    utiliser(jeu, e) { jeu.message('Bonjour !'); },
  },
};
