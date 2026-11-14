// Les systèmes stellaires écrits à la main dans src/systemes/ (voir src/systemes/_modele.js) :
// leurs paramètres, lisibles, deviennent des astres du jeu, au même format que ceux de system.js.
// Tout ce qui n'est pas donné est calculé : période (Kepler), sphère d'influence, gravité,
// température, couleurs vues de l'espace...
//
// buildSystems(defs) : { systems: [{ def, bodies, errors, warnings, active }], bodies (ceux des
// systèmes actifs, sans erreur), errors, warnings }. Un système avec une erreur n'entre pas dans le
// jeu (le message dit pourquoi) ; l'atelier (outils/atelier-systemes.html) les montre tous.
//
// Ce fichier ne dépend que de blocks.js (les noms des blocs) : les threads de génération le lisent.
import { BLOCKS } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';

// (les mêmes unités que system.js)
export const AU = 6.6e7;                   // une unité astronomique : l'orbite d'Hexa
export const LY = 63241 * AU;              // une année-lumière
export const RE = 14000;                   // le rayon d'Hexa
export const RS = 700000;                  // le rayon de l'étoile Hexa
export const YEAR = 120;                   // une année d'Hexa, en jours de jeu
const ZONE = 1e8;                          // (la largeur d'une zone de la carte : voir spacegen.js)
export const BUILTIN_IDS = new Set(['star', 'hexa', 'magmara', 'soufra', 'lune', 'ocra', 'orgon', 'brasia', 'azura', 'cryos', 'glacia', 'nox',
  'erebe', 'vesper', 'pelagia', 'pxta', 'pxtc', 'pxt3', 'pxt1', 'pxt2', 'azurion', 'cendre', 'eldra', 'lunule', 'glacyon',
  'ethana', 'ethanb', 'cinder', 'voss', 'halo', 'tessel', 'mourne', 'ash', 'pale', 'orrin', 'perse', 'lethe']);
// les styles de terrain déjà faits (planetgen.js) : terrain: { style: 'mars' }
export const BUILTIN_STYLES = ['moon', 'mars', 'desert', 'sandstone', 'volcanic', 'ironworld', 'io', 'europa', 'glacier', 'redice', 'pluto',
  'twilight', 'frozenocean', 'eldra', 'glacyon', 'cinder', 'voss', 'halo', 'tessel', 'perse', 'lethe'];

// ---------- Les étoiles : un type donne tout, chaque paramètre peut être changé ----------
// taille : en rayons de l'étoile Hexa ; masse : en masses d'Hexa ; eclat : sa lumière comparée à
// Hexa (panneaux solaires, température des planètes) ; lumiereAuSol : la part de lumière au sol de
// ses planètes (1 : plein jour) ; temperature : en kelvins (pour l'information)
export const STAR_TYPES = {
  'naine-jaune': { taille: 1, masse: 1, couleur: '#fff1d0', couronne: '#ffb048', eclat: 1, temperature: 5800, nom: 'Naine jaune' },
  'naine-orange': { taille: 0.75, masse: 0.7, couleur: '#ffc890', couronne: '#ff8a30', eclat: 0.3, temperature: 4300, nom: 'Naine orange' },
  'naine-rouge': { taille: 0.45, masse: 0.3, couleur: '#ffa078', couronne: '#ff4a20', eclat: 0.04, temperature: 3200, nom: 'Naine rouge' },
  'naine-blanche': { taille: 0.08, masse: 0.6, couleur: '#f0f4ff', couronne: '#b8ccff', eclat: 0.02, temperature: 25000, nom: 'Naine blanche' },
  'blanche': { taille: 1.7, masse: 1.8, couleur: '#eef4ff', couronne: '#9ec4ff', eclat: 8, temperature: 8500, nom: 'Étoile blanche' },
  'geante-bleue': { taille: 6, masse: 15, couleur: '#c4d8ff', couronne: '#4a7cff', eclat: 40, temperature: 25000, nom: 'Géante bleue' },
  'geante-rouge': { taille: 25, masse: 1.2, couleur: '#ff9060', couronne: '#ff3a10', eclat: 30, temperature: 3600, nom: 'Géante rouge' },
  'neutrons': { taille: 0.04, masse: 1.4, couleur: '#dce8ff', couronne: '#4f8cff', eclat: 0.03, lumiereAuSol: 0.3, temperature: 600000, pulsar: true, nom: 'Étoile à neutrons' },
  'pulsar': { taille: 0.04, masse: 1.4, couleur: '#dce8ff', couronne: '#4f8cff', eclat: 0.03, lumiereAuSol: 0.3, temperature: 600000, pulsar: true, faisceaux: true, nom: 'Pulsar' },
  'magnetar': { taille: 0.04, masse: 1.4, couleur: '#f2e4ff', couronne: '#b05aff', eclat: 0.02, lumiereAuSol: 0.3, temperature: 1000000, pulsar: true, nom: 'Magnétar' },
  'trou-noir': { taille: 0.85, masse: 10, couleur: '#ffb070', eclat: 0, temperature: 0, trou: true, nom: 'Trou noir' },
};
// les types de planètes : leur genre dans le jeu
const PLANET_KINDS = { rocheuse: 'rock', naine: 'dwarf', 'geante-gazeuse': 'gas', 'geante-glace': 'ice', lune: 'moon' };

// ---------- Les blocs : par leur numéro ou leur nom (« Basalte », « minerai de fer »...) ----------
const plain = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();
let byName = null;
const ALIASES = { eau: 7, lave: 72, 'eau glaciale': 200, air: 0, rien: 0, aucun: 0, feuilles: 6, tronc: 5 };
export function blockId(v) {
  if (v === null || v === undefined || v === false) return 0;
  if (typeof v === 'number') return BLOCKS[v] || v === 0 ? v : -1;
  if (!byName) {
    byName = new Map(Object.entries(ALIASES));
    for (const [id, b] of Object.entries(BLOCKS)) if (b?.name && !byName.has(plain(b.name))) byName.set(plain(b.name), +id);
  }
  const n = plain(v);
  return byName.has(n) ? byName.get(n) : /^\d+$/.test(n) && BLOCKS[+n] ? +n : -1;
}
export const blockName = (id) => (id === 0 ? 'Air' : BLOCKS[id]?.name || '#' + id);

// ---------- Couleurs : #rrggbb, #rgb, rgb(...), ou un nom (violet, vert, « rouge neutron »...) ----------
const NAMED = {
  blanc: '#ffffff', noir: '#000000', rouge: '#ff2a1a', orange: '#ff8a1a', jaune: '#ffe040', vert: '#3ad050', bleu: '#3a7aff',
  cyan: '#40e8ff', turquoise: '#30d8c0', violet: '#9a40ff', pourpre: '#b0208a', rose: '#ff70c0', magenta: '#ff30ff',
  marron: '#7a4a24', gris: '#8a8a8a', or: '#ffc840', argent: '#d0d8e0', indigo: '#4a30c0', emeraude: '#18c878',
  'rouge neutron': '#ff3060', 'bleu glacier': '#a8e0ff', 'vert acide': '#9aff20', 'violet profond': '#5a10b0', 'blanc bleute': '#e8f0ff',
};
export function colorHex(v) {
  if (typeof v === 'number' && v >= 0 && v <= 0xffffff) return '#' + v.toString(16).padStart(6, '0');
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  const m = s.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (m) return '#' + [m[1], m[2], m[3]].map((x) => Math.min(255, +x).toString(16).padStart(2, '0')).join('');
  return NAMED[plain(v)] || null;
}
const hexNum = (h) => parseInt(h.slice(1), 16);
function mixHex(a, b, t) {
  const A = hexNum(a), B = hexNum(b), f = (s) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t);
  return '#' + ((1 << 24) | (f(16) << 16) | (f(8) << 8) | f(0)).toString(16).slice(1);
}

// ---------- Les zones de la carte des planètes ajoutées (voir spacegen.js) ----------
// Chacune a sa place, tirée de son id (la même tant que l'id ne change pas : ajouter ou retirer
// d'autres planètes ne la déplace pas). zone : pour la choisir soi-même (40 à 169).
export const ZONE_MIN = 40, ZONE_MAX = 169;
function zoneHash(id) {
  let h = 2166136261;
  for (const ch of id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ZONE_MIN + ((h >>> 0) % (ZONE_MAX - ZONE_MIN + 1));
}
export function assignZones(bodies) {
  const used = new Map();
  for (const b of bodies.filter((x) => x.zone)) used.set(b.zone, b.id);
  for (const b of [...bodies].filter((x) => !x.zone).sort((a, c) => (a.id < c.id ? -1 : 1))) {
    let z = zoneHash(b.id);
    while (used.has(z)) z = z >= ZONE_MAX ? ZONE_MIN : z + 1;
    used.set(z, b.id);
    b.zone = z;
  }
}

// ---------- La conversion ----------
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const deg = (a) => (a * Math.PI) / 180;
// Inclinaison de l'orbite (degrés, -180 à 180) et direction de son point le plus haut (degrés) : dans b
// (incl, node : voir system.tiltOrbit). Rien de donné : presque à plat, comme avant
function orbitTilt(b, incl, node, what, err) {
  if (incl === undefined || incl === null || incl === '') return;
  const i = Number(incl), n = Number(node ?? 0);
  if (!Number.isFinite(i) || i < -180 || i > 180) { err(`${what} : inclinaison de l'orbite de -180 à 180 degrés`); return; }
  if (!Number.isFinite(n)) { err(`${what} : direction de la pente de l'orbite : un nombre de degrés`); return; }
  b.incl = deg(i);
  b.node = deg(n);
}

export function buildSystems(defs, { seen = new Set(BUILTIN_IDS) } = {}) {
  const out = { systems: [], bodies: [], errors: [], warnings: [] };
  for (const def of defs || []) {
    const S = buildOne(def, seen);
    out.systems.push(S);
    out.errors.push(...S.errors.map((e) => `[${S.name}] ${e}`));
    out.warnings.push(...S.warnings.map((e) => `[${S.name}] ${e}`));
    if (S.active && !S.errors.length) out.bodies.push(...S.bodies);
  }
  assignZones(out.bodies.filter((b) => b.gen));
  return out;
}

function buildOne(def, seen) {
  const errors = [], warnings = [], bodies = [];
  const S = { def, bodies, errors, warnings, name: def?.nom || def?.id || '?', active: def?.actif !== false };
  if (!def || typeof def !== 'object') { errors.push('le fichier n\'exporte pas un système (export default { ... })'); return S; }
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
  const okId = (id, what) => {
    if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(id)) { err(`${what} : id « ${id} » invalide (minuscules, chiffres et tirets seulement)`); return false; }
    if (seen.has(id)) { err(`${what} : l'id « ${id} » existe déjà ailleurs (il doit être unique dans tout l'univers)`); return false; }
    seen.add(id);
    return true;
  };
  const col = (v, d, what) => {
    if (v === undefined || v === null) return d;
    const h = colorHex(v);
    if (!h) { warn(`${what} : couleur « ${v} » inconnue (mets #rrggbb ou un nom : violet, vert, rouge neutron...)`); return d; }
    return h;
  };
  const blk = (v, d, what) => {
    if (v === undefined) return d;
    const id = blockId(v);
    if (id < 0) { err(`${what} : bloc « ${v} » introuvable (son nom exact, ou son numéro)`); return d; }
    return id;
  };
  if (!def.id) err('il manque l\'id du système');

  // ---------- Position dans l'univers ----------
  // position : { distance (années-lumière), direction (degrés, 0 à 360 autour d'Hexa), hauteur (degrés,
  // -90 à 90) } ou { x, y, z } (années-lumière, Hexa au centre)
  const P = def.position || {};
  let at;
  if (P.x !== undefined || P.z !== undefined) at = { x: num(P.x, 0) * LY, y: num(P.y, 0) * LY, z: num(P.z, 0) * LY };
  else {
    const d = num(P.distance, NaN), a = deg(num(P.direction, 0)), e = deg(num(P.hauteur, 0));
    if (!(d > 0)) err('position.distance manquante (en années-lumière, plus de 0)');
    at = { x: Math.cos(a) * Math.cos(e) * d * LY, y: Math.sin(e) * d * LY, z: Math.sin(a) * Math.cos(e) * d * LY };
  }
  const dist = Math.hypot(at.x, at.y, at.z);
  if (dist > 0 && dist < 2 * LY) warn('à moins de 2 années-lumière d\'Hexa : les deux systèmes se gênent (lumière, sphères d\'influence)');
  if (dist > 2000 * LY) err('plus loin que 2 000 années-lumière : trop loin pour la précision du jeu');

  // ---------- Les étoiles ----------
  const stars = Array.isArray(def.etoiles) ? def.etoiles : [];
  if (!stars.length) err('il faut au moins une étoile (etoiles: [ ... ])');
  const mass = {}; // (masses : en masses d'Hexa pour les étoiles, en masses d'Hexa-planète pour les planètes)
  const lumOf = {};
  let main = null;
  stars.forEach((s, i) => {
    const what = `étoile ${s?.nom || s?.id || i + 1}`;
    if (!s || !okId(s.id, what)) return;
    const T = STAR_TYPES[s.type || 'naine-jaune'];
    if (!T) { err(`${what} : type « ${s.type} » inconnu (${Object.keys(STAR_TYPES).join(', ')})`); return; }
    const p = { ...T, ...s };
    const R = Math.max(1000, num(p.taille, 1) * RS);
    const b = {
      id: s.id, name: s.nom || s.id, kind: T.trou ? 'hole' : 'star', R, tilt: deg(num(p.inclinaison, 0)), day: 1,
      color: col(p.couleur, T.couleur, what + ' couleur'), desc: p.description || `${T.nom} du système ${S.name}.`,
      temp: num(p.temperature, T.temperature), lum: num(p.eclat, T.eclat), custom: S.def.id,
    };
    if (T.trou) {
      b.c = 30000; b.gravity = 0;
      b.disk = (s.couleurDisque ?? s.couleur) !== undefined ? col(s.couleurDisque ?? s.couleur, null, what + ' couleurDisque') : null; // (sinon : les couleurs d'Érèbe)
    } else {
      b.corona = col(p.couronne, T.couronne, what + ' couronne');
      b.gravity = Math.round(28 * num(p.masse, T.masse) / Math.max(0.05, num(p.taille, T.taille)) ** 2 * 10) / 10;
      if (b.gravity > 80) b.gravity = 80;
      if (T.pulsar) { b.pulsar = true; b.beams = p.faisceaux ?? !!T.faisceaux; b.dim = num(p.lumiereAuSol, T.lumiereAuSol ?? 1); }
      else if (p.lumiereAuSol !== undefined) b.dim = num(p.lumiereAuSol, 1);
      if (b.beams && p.couleurFaisceaux) b.corona = col(p.couleurFaisceaux, b.corona, what + ' couleurFaisceaux');
    }
    mass[s.id] = num(p.masse, T.masse);
    lumOf[s.id] = b.lum;
    if (!main) {
      main = b;
      Object.assign(b, { parent: 'star', fixed: true, orbit: dist, at, period: 1, soi: 5e9 }); // (la sphère d'influence du système : comme les autres)
    } else {
      // une compagne : autour de l'étoile principale (ou d'une autre), ou en couple autour du barycentre
      const o = s.orbite || {};
      const par = o.autour || main.id, PB = bodies.find((x) => x.id === par);
      if (!PB) { err(`${what} : orbite.autour « ${par} » n'est pas une étoile de ce système (déclare-la avant)`); return; }
      const a = num(o.distance, NaN);
      if (!(a > 0)) { err(`${what} : orbite.distance manquante (en UA)`); return; }
      const M = mass[par] + mass[s.id];
      Object.assign(b, { parent: par, orbit: a * AU, ecc: Math.min(0.95, Math.max(0, num(o.excentricite, 0))),
        period: num(o.periode, YEAR * Math.sqrt(a ** 3 / M)), soi: Math.max(R * 4, a * AU * 0.3) });
      orbitTilt(b, o.inclinaison, o.noeud, what, err);
      if (o.barycentre && PB === main && !main.bary) main.bary = { with: s.id, share: mass[s.id] / M };
      if (a * AU < (R + PB.R) * 1.5) err(`${what} : trop près de ${PB.name} (les deux étoiles se touchent)`);
    }
    bodies.push(b);
  });

  // ---------- Les planètes et les lunes (dans l'ordre : un parent avant ses lunes) ----------
  const planets = Array.isArray(def.planetes) ? def.planetes : [];
  planets.forEach((p, i) => {
    const what = `planète ${p?.nom || p?.id || i + 1}`;
    if (!p || !okId(p.id, what) || !main) return;
    const autour = p.autour || main.id;
    const binary = autour === 'centre' || autour === 'les-deux';
    const P = binary ? main : bodies.find((x) => x.id === autour);
    if (!P) { err(`${what} : autour « ${autour} » introuvable dans ce système (déclare son astre avant elle)`); return; }
    const aroundStar = P.kind === 'star' || P.kind === 'hole';
    const type = p.type || (aroundStar ? 'rocheuse' : 'lune');
    let kind = PLANET_KINDS[type];
    if (!kind) { err(`${what} : type « ${type} » inconnu (${Object.keys(PLANET_KINDS).join(', ')})`); return; }
    if (!aroundStar && kind === 'rock') kind = 'moon';
    const R = Math.round(num(p.taille, kind === 'gas' ? 10 : kind === 'ice' ? 4 : kind === 'moon' ? 0.25 : 1) * RE);
    if (R < 800) { err(`${what} : taille trop petite (au moins 0,06 rayon d'Hexa)`); return; }
    if (2 * Math.PI * R > ZONE * 0.9) { err(`${what} : taille trop grande (au plus 1 000 rayons d'Hexa)`); return; }
    // distance : en UA autour d'une étoile, en rayons de la planète pour une lune
    const d = num(p.distance, NaN);
    if (!(d > 0)) { err(`${what} : distance manquante (${aroundStar ? 'en UA' : 'en rayons de ' + P.name})`); return; }
    const a = aroundStar ? d * AU : d * P.R;
    const gravity = num(p.gravite, kind === 'gas' ? 2.5 : kind === 'ice' ? 1.1 : Math.round(Math.min(3, R / RE) * 100) / 100);
    const m = gravity * (R / RE) ** 2; // (masse, en masses d'Hexa-planète : g ∝ M / R²)
    mass[p.id] = m;
    const Mc = binary ? mass[main.id] + (main.bary ? mass[main.bary.with] : 0) : mass[P.id];
    // la période : Kepler (autour d'une étoile, en années d'Hexa ; autour d'une planète, comme la
    // Lune d'Hexa : 4,2e5 blocs en 8 jours)
    const period = num(p.periode, aroundStar ? YEAR * Math.sqrt((a / AU) ** 3 / Mc) : 8 * Math.sqrt((a / 4.2e5) ** 3 / Math.max(0.001, Mc)));
    if (a < P.R * (aroundStar ? 3 : 1.5) + R) err(`${what} : trop près de ${P.name} (distance plus grande que ses rayons)`);
    if (binary && !main.bary) warn(`${what} : autour: 'centre' mais pas d'étoile en couple (orbite.barycentre: true) : elle tourne autour de ${main.name}`);
    if (binary && main.bary) {
      const sep = bodies.find((x) => x.id === main.bary.with).orbit;
      if (a < sep * 2.2) warn(`${what} : moins de 2,2 fois l'écart des deux étoiles : une orbite instable dans la réalité`);
    }
    // sphère d'influence (Laplace, plus large pour que l'arrivée soit douce)
    const ratio = aroundStar ? m * 3e-6 / Mc : m / Math.max(0.001, Mc);
    const soi = Math.round(Math.max(R * 6, Math.min(a * 0.5, 3 * a * ratio ** 0.4)));
    // température : comme Hexa (15 °C à 1 UA d'une naine jaune), selon l'éclat et la distance
    const sunId = aroundStar ? P.id : (() => { let q = P; while (q && q.kind !== 'star' && q.kind !== 'hole') q = bodies.find((x) => x.id === q.parent); return q?.id; })();
    const rootA = aroundStar ? a : P.orbit;
    const L = Math.max(0.0005, (lumOf[sunId] ?? 1) + (binary && main.bary ? lumOf[main.bary.with] : 0));
    const temp = num(p.temperature, Math.round(288 * L ** 0.25 / Math.sqrt(rootA / AU) - 273 + (num(p.atmosphere?.densite, 0) > 1 ? 20 * (p.atmosphere.densite - 1) : 0)));
    const b = {
      id: p.id, name: p.nom || p.id, kind, parent: P.id, circum: binary || undefined, orbit: a, ecc: num(p.excentricite, 0) || undefined,
      period, day: p.synchrone ? period : num(p.jour, 1), R, tilt: deg(num(p.inclinaison, 10)), soi, locked: !!p.synchrone || undefined,
      gravity, temp, desc: p.description || '', aurora: !!p.aurores || undefined, custom: S.def.id,
    };
    orbitTilt(b, p.inclinaisonOrbite, p.noeudOrbite, what, err);
    if (p.zone !== undefined) {
      if (!(p.zone >= ZONE_MIN && p.zone <= ZONE_MAX)) err(`${what} : zone ${p.zone} hors de ${ZONE_MIN} à ${ZONE_MAX}`);
      else b.zone = p.zone;
    }
    if (p.nuages === false) b.clouds = false;
    // atmosphère
    const A = p.atmosphere;
    if (A) {
      const sky = col(A.ciel, '#4a8ad8', what + ' atmosphere.ciel');
      b.atmo = { breath: !!A.respirable, sky, horizon: col(A.horizon, mixHex(sky, '#ffffff', 0.55), what + ' atmosphere.horizon'),
        density: Math.max(0, num(A.densite, 1)), rim: col(A.bord, mixHex(sky, '#ffffff', 0.35), what + ' atmosphere.bord') };
    } else b.atmo = { breath: false, sky: '#000000', horizon: '#000000', density: 0, rim: null };
    // géantes : bandes et tache
    if (kind === 'gas' || kind === 'ice') {
      const bandes = Array.isArray(p.bandes) && p.bandes.length ? p.bandes : kind === 'gas' ? ['#c98a4b', '#e2b884', '#a0623a', '#f0d6a8'] : ['#8ac8d8', '#a8dce8', '#7ab8cc'];
      b.bands = bandes.map((c, k) => col(c, '#888888', `${what} bandes[${k}]`));
      if (p.tache) b.spot = col(p.tache, null, what + ' tache');
      if (!A) b.atmo = { breath: false, sky: b.bands[0], horizon: b.bands[b.bands.length - 1], density: 3, rim: mixHex(b.bands[0], '#ffffff', 0.4) };
      if (p.terrain) warn(`${what} : une géante n'a pas de sol, son terrain est ignoré`);
    }
    // anneaux : [{ de, a, opacite }] en rayons de la planète
    if (Array.isArray(p.anneaux) && p.anneaux.length) {
      b.rings = p.anneaux.map((r) => [num(r.de, 1.4), num(r.a, 1.8), Math.max(0.05, Math.min(1, num(r.opacite, 0.5)))]);
      if (p.couleurAnneaux) b.ringColor = hexNum(col(p.couleurAnneaux, '#c8e0ea', what + ' couleurAnneaux'));
    }
    // le sol
    if (kind !== 'gas' && kind !== 'ice') {
      const g = buildTerrain(p.terrain || {}, { what, err, warn, blk, col, temp });
      if (g) b.gen = g;
    }
    // couleurs vues de l'espace (si le terrain n'en donne pas : voir planetgen.colorAt)
    const C = p.couleurs || {};
    const base = b.gen?.biomes?.[0]?.color || '#8a8a8a';
    b.colors = { low: col(C.bas, '#3a3a3e', what + ' couleurs.bas'), mid: col(C.milieu, base, what + ' couleurs.milieu'),
      high: col(C.haut, mixHex(base, '#ffffff', 0.25), what + ' couleurs.haut'), peak: col(C.sommet, '#f0f0f0', what + ' couleurs.sommet'),
      sea: col(C.mer, b.gen?.fluid === 72 ? '#ff6a18' : '#2a5a9a', what + ' couleurs.mer') };
    if (b.gen?.fluid === 72 || temp > 300) b.gen && (b.gen.hot = true);
    if ((b.gen?.temp ?? temp) < -20 && b.gen) b.gen.cold = true; // (il y neige)
    bodies.push(b);
  });
  if (def.ceintures) warn('ceintures : pas encore possibles hors du système Hexa (les astéroïdes sont placés autour d\'Hexa seulement)');
  return S;
}

// ---------- Le terrain (voir planetgen.js, le style « biomes ») ----------
function buildTerrain(t, { what, err, warn, blk, col, temp }) {
  const w = (k) => `${what} terrain.${k}`;
  if (t.style && t.style !== 'biomes') {
    // un style déjà fait, avec ses blocs (on peut en changer quelques-uns)
    if (!BUILTIN_STYLES.includes(t.style)) { err(`${w('style')} : « ${t.style} » inconnu (biomes, ${BUILTIN_STYLES.join(', ')})`); return null; }
    const mer = t.mer || {};
    return {
      style: t.style, base: num(t.base, 62), amp: num(t.relief, 22), sea: mer.niveau !== undefined ? mer.niveau : -999,
      fluid: mer.niveau !== undefined ? blk(mer.liquide ?? 'eau', 7, w('mer.liquide')) : 0,
      top: blk(t.dessus, 3, w('dessus')), sub: blk(t.dessous, 3, w('dessous')), rock: blk(t.roche, 3, w('roche')), deep: blk(t.profond, 68, w('profond')),
      maria: blk(t.mers ?? t.profond, 68, w('mers')),
      ores: ores(t.minerais, blk, w),
    };
  }
  const mer = t.mer || {};
  const g = {
    style: 'biomes',
    base: num(t.base, 62), amp: num(t.relief, 24), scale: num(t.continents, 1800), rough: num(t.rugosite, 0.5),
    sea: mer.niveau !== undefined && mer.liquide !== 'aucun' && mer.liquide !== null ? num(mer.niveau, 56) : -999,
    fluid: mer.niveau !== undefined && mer.liquide !== 'aucun' && mer.liquide !== null ? blk(mer.liquide ?? 'eau', 7, w('mer.liquide')) : 0,
    freeze: mer.gel === undefined ? null : blk(mer.gel === true ? 'Glace' : mer.gel, 0, w('mer.gel')),
    freezeT: num(mer.gelSous, 0),
    floor: blk(mer.fond, 8, w('mer.fond')),
    beach: mer.plage === false ? 0 : blk(mer.plage?.bloc ?? mer.plage ?? 'Sable', 8, w('mer.plage')), beachW: num(mer.plage?.largeur, 2),
    top: 3, sub: 3,
    rock: blk(t.roche, 3, w('roche')), deep: blk(t.profond, 68, w('profond')),
    layers: Array.isArray(t.strates) ? t.strates.map((x, k) => blk(x, 3, w(`strates[${k}]`))) : null, lh: num(t.epaisseurStrates, 2),
    caves: t.grottes !== false,
    ores: ores(t.minerais, blk, w),
    temp: num(t.temperature, temp), poles: num(t.ecartPoles, 40), lapse: num(t.froidAltitude, 0.6), wet: num(t.humidite, 0.5),
    mountains: feature(t.montagnes, { force: 0.5, taille: 900, hauteur: 40 }),
    craters: feature(t.crateres, { densite: 0, taille: 30 }),
    canyons: feature(t.canyons, { densite: 0, profondeur: 24, largeur: 1 }),
    volcanoes: feature(t.volcans, { densite: 0, hauteur: 40, taille: 120, lave: true }),
    plateaus: feature(t.plateaux, { densite: 0, hauteur: 14, marches: 4 }),
    dunes: feature(t.dunes, { force: 0, hauteur: 6, longueur: 30 }),
    biomes: [],
  };
  if (g.volcanoes.lave !== false) g.volcanoes.lava = blk(g.volcanoes.lave === true ? 'Lave' : g.volcanoes.lave, 72, w('volcans.lave'));
  if (g.fluid === 72) g.hot = true;
  const list = Array.isArray(t.biomes) && t.biomes.length ? t.biomes : [{ nom: 'Roche', dessus: 'Pierre', dessous: 'Pierre' }];
  list.forEach((B, k) => {
    const wb = (x) => `${what} biome ${B?.nom || k + 1} : ${x}`;
    if (!B) return;
    const range = (v, lo, hi) => (Array.isArray(v) ? [num(v[0], lo), num(v[1], hi)] : [lo, hi]);
    const C = B.conditions || {};
    const top = blk(B.dessus, 3, wb('dessus')), sub = blk(B.dessous ?? B.dessus, 3, wb('dessous'));
    const tree = B.arbres ? {
      density: Math.max(0, Math.min(1, num(B.arbres.densite, 0.3))), log: blk(B.arbres.tronc ?? 5, 5, wb('arbres.tronc')),
      leaves: blk(B.arbres.feuilles ?? 6, 6, wb('arbres.feuilles')), h: range(B.arbres.hauteur, 4, 7), crown: Math.max(0, num(B.arbres.couronne, 2)),
      gap: Math.max(3, num(B.arbres.espacement, 5)),
    } : null;
    g.biomes.push({
      name: B.nom || `Biome ${k + 1}`, color: col(B.couleur, null, wb('couleur')),
      T: range(C.temperature, -1e9, 1e9), H: range(C.humidite, -1e9, 1e9), A: range(C.altitude, -1e9, 1e9), L: range(C.latitude, 0, 1),
      top, sub, sd: num(B.epaisseur, 3),
      tree,
      plants: (Array.isArray(B.plantes) ? B.plantes : []).map((x, j) => ({ id: blk(x.bloc, 0, wb(`plantes[${j}]`)), p: Math.max(0, Math.min(1, num(x.densite, 0.05))) })).filter((x) => x.id > 0),
      rocks: (Array.isArray(B.formations) ? B.formations : []).map((x, j) => ({
        id: blk(x.bloc, 3, wb(`formations[${j}]`)), cap: blk(x.tete ?? 0, 0, wb(`formations[${j}].tete`)), p: Math.max(0, Math.min(1, num(x.densite, 0.1))),
        h: range(x.hauteur, 2, 5), w: Math.max(0.5, num(x.largeur, 1)), gap: Math.max(4, num(x.espacement, 14)),
      })),
      dunes: !!B.dunes,
    });
    if (!B.couleur) warn(wb('pas de couleur (couleur: \'#...\') : la vue de l\'espace et la carte la devinent mal'));
  });
  return g;
}
function ores(list, blk, w) {
  return (Array.isArray(list) ? list : []).map((o, k) => [blk(o.bloc, 60, w(`minerais[${k}]`)), Math.max(0, Math.min(0.2, num(o.frequence, 0.01))), num(o.profondeurMax, 50)]);
}
function feature(v, d) {
  if (v === undefined || v === null || v === false) return { ...d, densite: 0, force: 0 };
  if (v === true) return { ...d, densite: d.densite || 0.3, force: d.force || 0.5 };
  return { ...d, ...v };
}
