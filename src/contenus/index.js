// Les contenus ajoutés au jeu (blocs, objets, minerais, machines...) : un fichier par contenu dans ce
// dossier, leurs images dans texture/contenus/<clé>/. Cette liste est tenue à jour par l'atelier des
// contenus (lancer-atelier-contenus.bat) : crée et modifie tes contenus là-bas.
// À la main : copie _modele.js, puis ajoute-le ci-dessous (import + dans la liste CONTENUS).
//
// actif: false dans un contenu : il n'apparaît que dans l'atelier (un brouillon), pas dans le jeu.
// Une fois un contenu utilisé dans un monde, ne change plus son numéro (num) ni sa clé.
import c_cristal_sauteur from './cristal-sauteur.js?v=1.1.0-mx09tneh';

export const CONTENUS = [
  c_cristal_sauteur,
];
