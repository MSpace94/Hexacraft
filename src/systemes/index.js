// Les systèmes stellaires ajoutés à l'univers du jeu : un fichier par système dans ce dossier.
// Cette liste est tenue à jour par l'atelier (lancer-atelier.bat) : crée et modifie tes systèmes là-bas.
// À la main : copie _modele.js, puis ajoute-le ci-dessous (import + dans la liste SYSTEMES).
//
// actif: false dans un système : il n'apparaît que dans l'atelier (un brouillon), pas dans le jeu.
// Une fois qu'une planète a été visitée dans un monde, ne change plus son id (son nom, si).
import s_nyx from './nyx.js?v=1.1.5-alpha-mwgq2wrb';
import s_lumino from './lumino.js?v=1.1.5-alpha-mwgq2wrb';
import s_qoe from './qoe.js?v=1.1.5-alpha-mwgq2wrb';
import s_akhena from './akhena.js?v=1.1.5-alpha-mwgq2wrb';
import s_qse from './qse.js?v=1.1.5-alpha-mwgq2wrb';
import s_keryon from './keryon.js?v=1.1.5-alpha-mwgq2wrb';

export const SYSTEMES = [
  s_nyx,
  s_lumino,
  s_qoe,
  s_akhena,
  s_qse,
  s_keryon,
];
