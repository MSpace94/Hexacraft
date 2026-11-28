// Les meubles (onglet « Meubles » du créatif) : des blocs de décoration d'intérieur et d'extérieur,
// faits de petits prismes hexagonaux (un plateau, un pied, un dossier...). Textures : texture/blocs/
// meubles (outils/textures-meubles.cjs). Dessinés par mesher.js (drawFurniture).
// Chaque pièce : [dx, dz, y0, y1, r, matière, face] (dx, dz : décalage du centre, en tailles de case,
// l'avant du meuble vers +x ; y0, y1 : de bas en haut, en blocs ; r : rayon du prisme, 1 = la case ;
// face : la texture du côté avant, s'il en a une). Un meuble orienté (« dir ») a 6 variantes : son
// avant tourné vers le joueur qui le pose, comme le coffre.
// Recettes : les lettres P planches de chêne, N planches de noyer, S bâton, W laine blanche, I lingot
// de fer, G verre, T torche, L feuilles, D terre, C pierre taillée (voir survival.js).
export const FURN0 = 4630;

// matières : [dessus, côté] (le dessous : comme le dessus)
export const FURN_MAT = {
  chene: ['mb_chene', 'mb_chene'], noyer: ['mb_noyer', 'mb_noyer'],
  rouge: ['mb_tissu_rouge', 'mb_tissu_rouge'], bleu: ['mb_tissu_bleu', 'mb_tissu_bleu'], vert: ['mb_tissu_vert', 'mb_tissu_vert'], beige: ['mb_tissu_beige', 'mb_tissu_beige'],
  tapis_rouge: ['mb_tapis_rouge', 'mb_tissu_rouge'], tapis_bleu: ['mb_tapis_bleu', 'mb_tissu_bleu'],
  commode: ['mb_chene', 'mb_commode_cote'], fer: ['mb_fer', 'mb_fer'], abat_jour: ['mb_abat_jour', 'mb_abat_jour'], lanterne: ['mb_fer', 'mb_lanterne'],
  pot: ['mb_terre', 'mb_terre_cuite'], feuillage: ['mb_feuillage', 'mb_feuillage'], fleurs: ['mb_fleurs', 'mb_feuillage'], pierre: ['mb_fleurs', 'mb_pierre'],
  tonneau: ['mb_tonneau_dessus', 'mb_tonneau'], toile: ['mb_toile', 'mb_toile'], poubelle: ['mb_metal_vert', 'mb_metal_vert'], lettres: ['mb_boite_lettres', 'mb_boite_lettres'],
};

// (une table : un plateau, un pied au milieu, un pied élargi au sol)
const table = (m) => [[0, 0, 0.86, 1, 0.98, m], [0, 0, 0.06, 0.86, 0.12, m], [0, 0, 0, 0.06, 0.42, m]];
// (une chaise : l'assise, un pied, le dossier vers l'arrière : deux montants et une traverse)
const chair = (m) => [[0, 0, 0.44, 0.54, 0.6, m], [0, 0, 0, 0.44, 0.1, m], [-0.42, -0.24, 0.54, 1, 0.1, m], [-0.42, 0.24, 0.54, 1, 0.1, m], [-0.44, 0, 0.8, 0.96, 0.24, m]];
// (un canapé : le socle de bois, le coussin, le dossier, deux accoudoirs)
const sofa = (m, w = 'noyer') => [[0, 0, 0, 0.16, 0.94, w], [0.1, 0, 0.16, 0.44, 0.78, m], [-0.52, 0, 0.16, 0.92, 0.36, m], [0.05, -0.56, 0.16, 0.62, 0.24, m], [0.05, 0.56, 0.16, 0.62, 0.24, m]];

// [nom, clé, pièces, { dir, height, light, thin, matter, recipe: [motif, nombre] }] ; et seat : on s'y
// assoit (clic droit), à cette hauteur ; sofa : les canapés côte à côte se raccordent (voir mesher.js) ;
// rug : un tapis, raccordé à ceux qui le touchent (ses textures de fond et de bord) ; container : un
// rangement, comme un coffre
const LIST = [
  // ---- intérieur ----
  ['Table en chêne', 'table_chene', table('chene'), { height: 1, recipe: [['PPP', '.S.', '.S.'], 1] }],
  ['Table en noyer', 'table_noyer', table('noyer'), { height: 1, recipe: [['NNN', '.S.', '.S.'], 1] }],
  ['Chaise en chêne', 'chaise_chene', chair('chene'), { dir: true, height: 0.55, seat: 0.54, recipe: [['P..', 'PPP', 'S.S'], 2] }],
  ['Chaise en noyer', 'chaise_noyer', chair('noyer'), { dir: true, height: 0.55, seat: 0.54, recipe: [['N..', 'NNN', 'S.S'], 2] }],
  ['Tabouret', 'tabouret', [[0, 0, 0.55, 0.66, 0.44, 'chene'], [0, 0, 0.05, 0.55, 0.09, 'chene'], [0, 0, 0, 0.05, 0.3, 'chene']], { height: 0.66, seat: 0.66, recipe: [['PPP', '.S.'], 2] }],
  ['Canapé rouge', 'canape_rouge', sofa('rouge'), { dir: true, height: 0.45, seat: 0.44, sofa: true, recipe: [['W..', 'WWW', 'NNN'], 1] }],
  ['Canapé bleu', 'canape_bleu', sofa('bleu'), { dir: true, height: 0.45, seat: 0.44, sofa: true, recipe: [['W..', 'WWW', 'NNN'], 1] }],
  ['Fauteuil vert', 'fauteuil_vert', [[0, 0, 0, 0.14, 0.8, 'noyer'], [0.08, 0, 0.14, 0.42, 0.62, 'vert'], [-0.45, 0, 0.14, 0.9, 0.3, 'vert'], [0, -0.48, 0.14, 0.6, 0.2, 'vert'], [0, 0.48, 0.14, 0.6, 0.2, 'vert']], { dir: true, height: 0.42, seat: 0.42, recipe: [['W..', 'WW.', 'NN.'], 1] }],
  ['Pouf beige', 'pouf', [[0, 0, 0, 0.4, 0.58, 'beige'], [0, 0, 0.4, 0.44, 0.5, 'beige']], { height: 0.44, seat: 0.44, recipe: [['WW', 'WW'], 1] }],
  ['Commode', 'commode', [[0, 0, 0, 0.92, 0.94, 'commode', 'mb_commode_face']], { dir: true, height: 0.92, container: 'chest', recipe: [['PPP', 'PHP', 'PPP'], 1] }],
  ['Lampe de chevet', 'lampe', [[0, 0, 0, 0.06, 0.28, 'fer'], [0, 0, 0.06, 0.56, 0.05, 'fer'], [0, 0, 0.52, 0.9, 0.36, 'abat_jour']], { height: 0.9, light: 1, recipe: [['W', 'T', 'I'], 1] }],
  ['Plante en pot', 'plante', [[0, 0, 0, 0.42, 0.32, 'pot'], [0, 0, 0.42, 0.96, 0.42, 'feuillage'], [0, 0, 0.96, 1, 0.24, 'feuillage']], { height: 0.96, matter: 'leaves', recipe: [['L', 'D', 'C'], 1] }],
  ['Tapis rouge', 'tapis_rouge', [[0, 0, 0, 0.06, 1, 'tapis_rouge']], { height: 0.06, matter: 'wool', rug: 'tapis_rouge', recipe: [['WWW'], 3] }],
  ['Tapis bleu', 'tapis_bleu', [[0, 0, 0, 0.06, 1, 'tapis_bleu']], { height: 0.06, matter: 'wool', rug: 'tapis_bleu', recipe: [['WW', 'WW'], 3] }],
  // ---- extérieur ----
  ['Banc de jardin', 'banc', [[0, 0, 0.38, 0.48, 0.88, 'chene'], [0.1, -0.5, 0, 0.38, 0.09, 'fer'], [0.1, 0.5, 0, 0.38, 0.09, 'fer'], [-0.48, -0.42, 0.48, 0.94, 0.2, 'chene'], [-0.5, 0, 0.48, 0.94, 0.22, 'chene'], [-0.48, 0.42, 0.48, 0.94, 0.2, 'chene']], { dir: true, height: 0.48, seat: 0.48, recipe: [['P..', 'PPP', 'I.I'], 1] }],
  ['Table de jardin', 'table_jardin', [[0, 0, 0.72, 0.78, 0.84, 'fer'], [0, 0, 0.05, 0.72, 0.06, 'fer'], [0, 0, 0, 0.05, 0.36, 'fer']], { height: 0.78, recipe: [['III', '.I.', '.I.'], 1] }],
  ['Lampadaire', 'lampadaire', [[0, 0, 0, 0.1, 0.3, 'fer'], [0, 0, 0.1, 0.7, 0.07, 'fer'], [0, 0, 0.7, 0.94, 0.26, 'lanterne'], [0, 0, 0.94, 1, 0.32, 'fer']], { height: 1, light: 5, recipe: [['G', 'T', 'I'], 1] }],
  ['Parasol', 'parasol', [[0, 0, 0, 0.88, 0.05, 'fer'], [0, 0, 0.86, 0.94, 1, 'toile'], [0, 0, 0.94, 1, 0.3, 'toile']], { recipe: [['WWW', '.I.', '.I.'], 1] }],
  ['Jardinière fleurie', 'jardiniere', [[0, 0, 0, 0.46, 0.94, 'pierre'], [0, 0, 0.46, 0.7, 0.8, 'fleurs']], { height: 0.7, matter: 'stone', recipe: [['LLL', 'CDC'], 1] }],
  ['Tonneau', 'tonneau', [[0, 0, 0, 0.96, 0.8, 'tonneau']], { height: 0.96, recipe: [['PIP', 'P.P', 'PIP'], 1] }],
  ['Poubelle', 'poubelle', [[0, 0, 0, 0.78, 0.38, 'poubelle'], [0, 0, 0.78, 0.84, 0.42, 'poubelle'], [0, 0, 0.84, 0.88, 0.14, 'fer']], { height: 0.88, matter: 'metal', recipe: [['I.I', 'I.I', 'III'], 1] }],
  ['Boîte aux lettres', 'boite_lettres', [[0, 0, 0, 0.6, 0.06, 'chene'], [0.05, 0, 0.6, 0.9, 0.3, 'lettres']], { dir: true, height: 0.9, matter: 'metal', recipe: [['II', 'IS'], 1] }],
];

// Les meubles, avec leur numéro : { id, name, key, parts, dir, ... }
export const FURNITURE = [];
let next = FURN0;
for (const [name, key, parts, o] of LIST) {
  FURNITURE.push({ id: next, name, key, parts, ...o });
  next += o.dir ? 6 : 1;
}
// Les deux meubles pleins (un bloc entier) : bibliothèque, caisse
export const BOOKSHELF = next, CRATE = next + 1;
export const FURN_LAST = CRATE;
export const FURN_TEXTURES = [...new Set([...Object.values(FURN_MAT).flat(), 'mb_commode_face', 'mb_bibliotheque', 'mb_caisse', 'mb_caisse_dessus', 'mb_tapis_rouge_fond', 'mb_tapis_rouge_bord', 'mb_tapis_bleu_fond', 'mb_tapis_bleu_bord'])];
