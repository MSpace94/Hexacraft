// Skins du joueur : fichiers PNG 64x64 (format des skins Minecraft) du dossier
// texture/entites/joueur/skins/, listés dans liste.json : [{ "fichier": "x.png", "nom": "Nom" }].
// Pour ajouter une skin : mettre le PNG dans ce dossier et l'ajouter à la liste.
// "exclusif": true : skin réservée aux comptes qui l'ont obtenue (code cadeau, voir account.js
// et supabase/schema.sql) ; les autres ne peuvent pas la choisir (mais la voient en multijoueur).
// En multijoueur, chacun envoie le nom de son fichier ; les autres la voient s'ils l'ont aussi
// (même version du jeu), sinon ils voient la skin par défaut.
export const SKIN_DIR = 'texture/entites/joueur/skins/';
export const DEFAULT_SKIN = 'defaut.png';
const FILE_RE = /^[\w-]{1,40}\.png$/;

let list = [{ file: DEFAULT_SKIN, name: 'Défaut' }];

export async function loadSkins() {
  try {
    const data = await (await fetch(SKIN_DIR + 'liste.json')).json();
    const ok = (Array.isArray(data) ? data : [])
      .filter((s) => s && FILE_RE.test(s.fichier))
      .map((s) => ({ file: s.fichier, name: String(s.nom || s.fichier.replace(/\.png$/, '')).slice(0, 24), exclusive: s.exclusif === true }));
    if (ok.length) list = ok;
  } catch { /* liste illisible : skin par défaut seulement */ }
  return list;
}

export const skins = () => list;
// Skins qu'on peut choisir : toutes, sauf les skins réservées qu'on n'a pas (owned : Set de fichiers)
export const skinsFor = (owned) => list.filter((s) => !s.exclusive || owned?.has(s.file));

// Fichier de skin connu (sinon celui par défaut)
export const skinFile = (file) => (list.some((s) => s.file === file) ? file : list[0].file);
export const skinUrl = (file) => SKIN_DIR + skinFile(file);
