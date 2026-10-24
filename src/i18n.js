// Langues du jeu : français (la langue du code) et anglais.
// Le jeu est écrit en français ; en anglais, les textes sont traduits là où ils s'affichent :
// un observateur de la page remplace chaque texte français par sa traduction (lang/en.js),
// y compris les textes fabriqués à la volée (« Code validé : {0} » -> « Code accepted: {0} »,
// chaque morceau variable étant lui-même traduit s'il est connu : noms d'objets, etc.).
// Les rares textes dessinés hors de la page (carte) passent par t().
// On change de langue dans les Options ; le jeu redémarre pour l'appliquer.
import EN from './lang/en.js?v=1.1.5-alpha-mvm2b95g';

const OPT_KEY = 'hexacraft.options';
export const LANG = (() => { try { return JSON.parse(localStorage.getItem(OPT_KEY))?.lang === 'en' ? 'en' : 'fr'; } catch { return 'fr'; } })();
export const LANGS = [['fr', 'Français'], ['en', 'English']];

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const exact = new Map();
const patterns = [];
const cache = new Map();

if (LANG === 'en') {
  for (const [fr, en] of Object.entries(EN)) {
    const k = norm(fr);
    if (!/\{\d+\}/.test(k)) { exact.set(k, en); continue; }
    // gabarit : les {n} deviennent des morceaux variables
    const parts = k.split(/(\{\d+\})/);
    const order = [];
    const re = parts.map((p) => {
      const m = /^\{(\d+)\}$/.exec(p);
      if (m) { order.push(+m[1]); return '([\\s\\S]*?)'; }
      return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    patterns.push({ re: new RegExp('^' + re + '$'), order, en, fixed: k.replace(/\{\d+\}/g, '').length });
  }
  patterns.sort((a, b) => b.fixed - a.fixed); // (les plus précis d'abord)
}

// Traduit un texte (en français : tel quel)
export function translate(text) {
  if (LANG === 'fr' || !text) return text;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  let core = translateCore(m[2]);
  // (plusieurs lignes : ligne par ligne si le tout n'est pas connu)
  if (core === null && m[2].includes('\n')) {
    const lines = m[2].split('\n').map((l) => translateCore(l.trim()) ?? l);
    core = lines.join('\n');
  }
  const res = core === null ? text : m[1] + core + m[3];
  if (cache.size > 20000) cache.clear();
  cache.set(text, res);
  return res;
}
function translateCore(s) {
  if (!s) return s;
  const k = norm(s);
  if (exact.has(k)) return exact.get(k);
  for (const p of patterns) {
    const mm = p.re.exec(k);
    if (!mm) continue;
    let out = p.en;
    p.order.forEach((n, i) => {
      const v = mm[i + 1];
      const tv = translateCore(v) ?? v;
      out = out.split('{' + n + '}').join(tv);
    });
    // (un gabarit qui ne change rien n'est pas une traduction : on essaie la suite, ou ligne
    // par ligne ; sinon « {0}, {1} » avalerait toute phrase qui contient une virgule)
    if (out !== k) return out;
  }
  return null;
}

// Pour le code : t('Bonjour {0}', nom)
export function t(fr, ...args) {
  let s = fr;
  args.forEach((a, i) => { s = s.split('{' + i + '}').join(String(a)); });
  return translate(s);
}

// ---------- Traduction de la page ----------
const ATTRS = ['placeholder', 'title', 'aria-label'];
// (ce qui ne se traduit pas : ce que tape le joueur, le débogage, les messages des joueurs)
const SKIP = (el) => !!el?.closest?.('input, textarea, script, style, #debug, [data-no-i18n], .msg.chat');
function doNode(n) {
  if (n.nodeType === 3) {
    if (!n.data.trim() || SKIP(n.parentElement)) return;
    const tr = translate(n.data);
    if (tr !== n.data) n.data = tr;
  } else if (n.nodeType === 1) {
    // (les champs de saisie : leur texte d'exemple seulement, jamais ce qu'on y tape)
    if (SKIP(n) && !((n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') && !n.closest('[data-no-i18n], #debug'))) return;
    for (const a of ATTRS) {
      const v = n.getAttribute(a);
      if (v) { const tr = translate(v); if (tr !== v) n.setAttribute(a, tr); }
    }
    if (n.tagName === 'INPUT' && (n.type === 'button' || n.type === 'submit') && n.value) n.value = translate(n.value);
    for (const c of n.childNodes) doNode(c);
  }
}
export function startPageTranslation() {
  if (LANG === 'fr') return;
  document.documentElement.lang = 'en';
  document.title = translate(document.title);
  doNode(document.body);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') doNode(m.target);
      else if (m.type === 'attributes') doNode(m.target.nodeType === 1 ? m.target : m.target.parentElement);
      else for (const n of m.addedNodes) doNode(n);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
