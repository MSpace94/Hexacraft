// Les contenus ajoutés (src/contenus/, faits avec l'atelier des contenus : lancer-atelier-contenus.bat) :
// blocs, objets, minerais, machines, nourriture, outils, armes, réservoirs. Ce module ne dépend que
// de leur liste : chaque partie du jeu y prend ce qui la concerne (blocks.js : les blocs et objets ;
// textures.js : les images ; survival.js : recettes, dureté ; containers.js : four, combustible ;
// industry.js : les machines ; tnt.js : les explosifs ; metals.js : les minerais ; main.js et
// contenus-api.js : le code personnalisé).
// Les numéros : 12000 et plus, donnés une fois pour toutes par l'atelier (num) ; ne jamais les
// changer une fois le contenu utilisé dans un monde (les mondes gardent les numéros).
import { CONTENUS } from './contenus/index.js?v=1.1.0-mx09tneh';

export const CUSTOM_BASE = 12000, CUSTOM_MAX = 16383;
export const TYPES = {
  bloc: { nom: 'Bloc', bloc: true },
  minerai: { nom: 'Minerai', bloc: true },
  machine: { nom: 'Machine', bloc: true },
  reservoir: { nom: 'Réservoir', bloc: true },
  objet: { nom: 'Objet' },
  nourriture: { nom: 'Nourriture' },
  outil: { nom: 'Outil' },
  arme: { nom: 'Arme' },
};
export const EVENTS = {
  utiliser: 'Clic droit (l\'objet en main, ou sur le bloc posé)',
  poser: 'Le bloc est posé par un joueur',
  casser: 'Le bloc est cassé par un joueur',
  manger: 'La nourriture est mangée',
  frapper: 'Un animal est frappé avec l\'objet en main',
  chaqueSeconde: 'Chaque seconde (bloc posé dans le monde, près d\'un joueur)',
  enMain: 'Chaque seconde, tant que l\'objet est en main',
};
const okNum = (n) => Number.isInteger(n) && n >= CUSTOM_BASE && n <= CUSTOM_MAX;
export const ALL = (Array.isArray(CONTENUS) ? CONTENUS : []).filter((c) => c && typeof c.cle === 'string' && TYPES[c.type] && okNum(c.num));
export const ACTIFS = ALL.filter((c) => c.actif !== false);
const byCle = new Map(ACTIFS.map((c) => [c.cle, c]));
const byNum = new Map(ACTIFS.map((c) => [c.num, c]));
// Un objet désigné par son numéro, ou un contenu par sa clé ('cristal-bleu') -> numéro (0 : inconnu)
export const ref = (x) => (Number.isInteger(x) ? x : typeof x === 'string' ? byCle.get(x)?.num || (/^\d+$/.test(x) ? +x : 0) : 0);
export const contentOf = (num) => byNum.get(num) || null;
export const isBlockType = (c) => !!TYPES[c.type]?.bloc;
const slug = (c) => c.cle.replace(/[^a-z0-9]/g, '_');
// (les images : texture/contenus/<clé>/haut.png, cote.png, bas.png, icone.png)
export const texName = (c, face) => 'c_' + slug(c) + '_' + face;
export const texFile = (c, face) => 'contenus/' + c.cle + '/' + face + '.png';
export const iconFile = (c) => 'texture/contenus/' + c.cle + '/icone.png';
const faces = (c) => ({ haut: c.faces?.haut ? 'haut' : 'cote', cote: 'cote', bas: c.faces?.bas ? 'bas' : c.faces?.haut ? 'haut' : 'cote' });
const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d);

// Les textures à charger : { nom: chemin sous texture/ }
export function textureFiles() {
  const out = {};
  for (const c of ACTIFS) if (isBlockType(c)) for (const f of new Set(Object.values(faces(c)))) out[texName(c, f)] = texFile(c, f);
  return out;
}

// La définition d'un bloc (BLOCKS) et de l'objet (ITEMS) d'un contenu
export function blockDef(c) {
  const F = faces(c);
  const b = { name: c.nom || c.cle, top: texName(c, F.haut), side: texName(c, F.cote), bottom: texName(c, F.bas), custom: c.cle };
  if (c.transparent) b.glass = true;
  if (c.solide === false) { b.thin = true; b.glass = true; }
  if (c.lumiere) b.light = num(c.lumiere, 0, 15, 0);
  if (c.ressort) b.spring = true;
  if (c.incassable) b.unbreakable = true;
  if (c.donne) { const d = Array.isArray(c.donne) ? c.donne : [c.donne, 1]; if (ref(d[0])) b.cdrop = [ref(d[0]), num(d[1], 1, 64, 1)]; }
  if (c.explosif) b.ctnt = true;
  if (c.type === 'machine') Object.assign(b, { container: 'machine', machine: 'c_' + slug(c), power: 'use' });
  if (c.type === 'reservoir') Object.assign(b, { fluid: 'tank', cap: num(c.reservoir, 1000, 1e6, 8000) });
  if (c.code?.chaqueSeconde) b.tick = true;
  return b;
}
export function itemDef(c) {
  const it = { name: c.nom || c.cle, icon: iconFile(c), custom: c.cle };
  if (c.pile) it.stack = num(c.pile, 1, 64, 64);
  if (c.type === 'nourriture') it.food = num(c.nourriture, 1, 24, 4);
  if (c.type === 'outil') Object.assign(it, { tool: ['pickaxe', 'axe', 'shovel', 'sword', 'hoe'].includes(c.outil?.sorte) ? c.outil.sorte : 'pickaxe', tier: num(c.outil?.niveau, 1, 8, 3), stack: 1 });
  if (c.type === 'arme') Object.assign(it, { tool: 'sword', tier: num(c.outil?.niveau, 1, 8, 3), damage: num(c.degats, 1, 200, 6), stack: 1 });
  return it;
}
// Les blocs et objets de tous les contenus actifs (voir blocks.js)
export function registerBlocksItems(BLOCKS, ITEMS) {
  for (const c of ACTIFS) {
    if (BLOCKS[c.num] || ITEMS[c.num]) { console.warn('contenu ' + c.cle + ' : le numéro ' + c.num + ' est déjà pris'); continue; }
    if (isBlockType(c)) BLOCKS[c.num] = blockDef(c);
    else ITEMS[c.num] = itemDef(c);
  }
}

// Les recettes d'établi : { p: ['ABA', ...], k: { A: id }, out: [id, n] } (voir survival.js)
export function recipes() {
  const out = [];
  for (const c of ACTIFS) {
    const R = c.recette;
    if (!R || !Array.isArray(R.grille) || !R.grille.length) continue;
    const k = {};
    let ok = true;
    for (const ch of new Set(R.grille.join('').replace(/\./g, ''))) { k[ch] = ref(R.cles?.[ch]); if (!k[ch]) ok = false; }
    if (ok) out.push({ p: R.grille.map(String), k, out: [c.num, num(R.donne, 1, 64, 1)] });
    else console.warn('contenu ' + c.cle + ' : recette incomplète');
  }
  return out;
}
// Les minerais à générer : { ore, salt, surf | deep: [y bas, y haut, chance] } (voir metals.js, gen.js)
export function ores() {
  const out = [];
  for (const c of ACTIFS) {
    if (c.type !== 'minerai' || !c.gen) continue;
    let salt = 7001;
    for (const ch of c.cle) salt = (salt * 31 + ch.charCodeAt(0)) % 90001;
    const g = c.gen, range = [Math.round(num(g.de, -60, 150, 0)), Math.round(num(g.a, -60, 150, 40)), num(g.chance, 0.001, 0.9, 0.1)];
    if (range[0] > range[1]) range.reverse();
    const m = { ore: c.num, salt: 3000 + salt, custom: c.cle };
    if (range[1] >= 0) m.surf = [Math.max(0, range[0]), range[1], range[2]];
    if (range[0] < 0) m.deep = [range[0], Math.min(-1, range[1]), range[2]];
    out.push(m);
  }
  return out;
}
// Machines : { kind: { recettes: { entrée: [sortie, n] }, temps, watts } }
export function machines() {
  const out = {};
  for (const c of ACTIFS) {
    if (c.type !== 'machine') continue;
    const R = {};
    for (const r of c.machine?.recettes || []) { const a = ref(r[0]), b = ref(r[1]); if (a && b) R[a] = [b, num(r[2], 1, 64, 1)]; }
    out['c_' + slug(c)] = { recettes: R, temps: num(c.machine?.temps, 0.2, 600, 4), watts: num(c.machine?.watts, 0, 100000, 20) };
  }
  return out;
}
