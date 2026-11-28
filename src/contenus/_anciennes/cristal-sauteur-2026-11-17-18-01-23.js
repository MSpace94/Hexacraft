// Contenu ajouté avec l'atelier des contenus (lancer-atelier-contenus.bat) : voir src/contenus/_modele.js
export default {
  cle: "cristal-sauteur",
  num: 12000, // ne plus le changer
  actif: false,
  type: "bloc",
  nom: "Cristal sauteur",
  lumiere: 8,
  ressort: true,
  durete: "stone",
  recette: {"grille":["AA","BA"],"cles":{"A":40,"B":4175},"donne":1},
  code: {
    utiliser(jeu, e) {
      // ex. : un message, et une petite explosion là où on regarde
      jeu.message('Boum !');
      const j = jeu.joueur;
      jeu.explosion(j.x + j.regard.x * 4, j.y + 1 + j.regard.y * 4, j.z + j.regard.z * 4, 0.5);
    },
  },
  // (les dessins de l'atelier, pour les retoucher)
  pixels: {"cote":{"p":["#3a7ad8","#7ac8ff"],"d":"000000000000000001000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000100000000000000000","grain":1}},
};
