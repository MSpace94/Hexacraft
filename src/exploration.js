// Le carnet d'exploration (touche L, ou le menu pause) : tout ce qu'on a découvert dans ce monde.
//  - les biomes : les ~145 biomes des autres planètes (voir planetbiomes.js), ceux des mondes tempérés
//    de la Voie lactée et ceux de Hexa forment une collection ; chaque biome où l'on marche se coche
//    (un biome repéré par le scanner orbital, lui, s'affiche sans être coché)
//  - les planètes où l'on a marché (ou qu'on a scannées) : favorites, et une description à soi
//  - les systèmes visités, et les étoiles célèbres atteintes (celles qu'on voit depuis la Terre)
//  - la vie des autres mondes (voir xenolife.js, microbes.js) : la faune, la flore, les microbes vus au
//    microscope, et l'écologie observée (qui mange qui, les migrations)
//  - les récompenses : des succès, des plans (des recettes qui ne se font qu'une fois le plan
//    obtenu, voir survival.recipeLocked) et des capes
// Le scanner orbital : tenu en main au-dessus d'une planète (en orbite), un clic droit révèle les
// biomes et les gisements de la région sous le vaisseau : la carte du monde se remplit d'abord par
// scan (en survie, elle ne montre que ce qu'on a exploré ou scanné), les gisements y sont marqués.
// Sauvegardé avec le monde (data.carnet ; pour un invité en ligne : sur ce PC, voir main.js).
import { PLANET_BIOMES } from './planetbiomes.js?v=1.1.0-mx09tneh';
import { GAL_N, GFAMOUS, GNAME, SGRA_ID, gxIndex, gxId, temperateBiomes } from './galaxie.js?v=1.1.0-mx09tneh';
import { BIOME_NAMES, BIOME_COLORS } from './gen.js?v=1.1.0-mx09tneh';
import { drawMicroscope } from './microbes.js?v=1.1.0-mx09tneh';

export const SCAN_CELL = 128;           // case du scan (blocs)
export const SCAN_R = [0, 1400, 3600];  // rayon d'un scan : scanner I, II (blocs)
export const SCAN_ALT = [0, 9000, 30000]; // altitude au plus au-dessus du sol (blocs)
const NOTE_MAX = 2000;

// ---------- La collection ----------
const STYLE_TITLES = {
  moon: 'Mondes lunaires', mars: 'Mondes de type Mars', desert: 'Déserts brûlants', sandstone: 'Mondes de grès', volcanic: 'Mondes volcaniques',
  ironworld: 'Mondes de fer', io: 'Lunes de soufre', europa: 'Lunes de glace', glacier: 'Mondes glaciaires', redice: 'Glaces rouges',
  pluto: "Mondes d'azote", twilight: 'Mondes du crépuscule', frozenocean: 'Océans gelés', eldra: 'Mondes violets (Eldra)', glacyon: 'Mondes roses (Glacyon)',
  cinder: 'Mondes de scories (Cinder)', voss: 'Mondes de diamant (Voss)', halo: 'Mondes oasis (Halo)', tessel: 'Mondes de cristal (Tessel)',
  perse: 'Mondes de glace bleue (Perse)', lethe: 'Mondes de poussière noire (Lethe)', biomes: 'Mondes tempérés des galaxies',
};
export const styleTitle = (st) => STYLE_TITLES[st] || st;
// [{ style, title, list: [{ key, n, c }] }] : les planètes (à cocher), puis Hexa (en plus)
export const CATALOG = (() => {
  const out = [];
  for (const [style, L] of Object.entries(PLANET_BIOMES)) {
    const seen = new Set(), list = [];
    for (const B of L) if (!seen.has(B.n)) { seen.add(B.n); list.push({ key: style + ':' + B.n, n: B.n, c: B.c }); }
    out.push({ style, title: styleTitle(style), list });
  }
  const half = () => 0.5;
  out.push({ style: 'biomes', title: styleTitle('biomes'), list: temperateBiomes(half).map((B) => ({ key: 'biomes:' + B.nom, n: B.nom, c: B.couleur || '#888' })) });
  return out;
})();
export const HEXA_BIOMES = { style: 'hexa', title: 'Hexa (la planète d\'origine)', list: BIOME_NAMES.map((n, i) => ({ key: 'hexa:' + n, n, c: '#' + BIOME_COLORS[i].map((v) => v.toString(16).padStart(2, '0')).join('') })) };
const ALL_KEYS = new Set(CATALOG.flatMap((S) => S.list.map((B) => B.key)));
export const BIOME_TOTAL = ALL_KEYS.size;
// Les étoiles célèbres : celles du catalogue (vues depuis la Terre) et Sagittarius A*
export const FAMOUS = [...Array.from({ length: GAL_N }, (_, i) => i).filter((i) => GFAMOUS[i]).map((i) => ({ id: gxId(i), n: GNAME[i] })), { id: SGRA_ID, n: 'Sagittarius A*' }];
const FAMOUS_IDS = new Set(FAMOUS.map((s) => s.id));

// ---------- Les récompenses ----------
// what : le compteur (biomes, stars) ; kind : succès (ach, voir account.js), plan (recette), cape
export const MILESTONES = [
  { what: 'biomes', n: 1, kind: 'ach', id: 'carnet_premier', name: 'Succès « Premier relevé »' },
  { what: 'biomes', n: 5, kind: 'plan', id: 'tapis', name: 'Plan : tapis de mousse violette' },
  { what: 'biomes', n: 10, kind: 'ach', id: 'carnet_10', name: 'Succès « Naturaliste en herbe »' },
  { what: 'biomes', n: 10, kind: 'plan', id: 'scanner2', name: 'Plan : scanner orbital II' },
  { what: 'biomes', n: 20, kind: 'plan', id: 'lanterne', name: 'Plan : lanterne de cristal' },
  { what: 'biomes', n: 25, kind: 'cape', id: 'carnet_explorateur', name: 'Cape « Explorateur »' },
  { what: 'biomes', n: 50, kind: 'ach', id: 'carnet_50', name: 'Succès « Atlas vivant »' },
  { what: 'biomes', n: 75, kind: 'cape', id: 'carnet_cartographe', name: 'Cape « Cartographe des mondes »' },
  { what: 'biomes', n: 100, kind: 'ach', id: 'carnet_100', name: 'Succès « Cent mondes »' },
  { what: 'biomes', n: BIOME_TOTAL, kind: 'ach', id: 'carnet_tous', name: 'Succès « Le grand herbier »' },
  { what: 'biomes', n: BIOME_TOTAL, kind: 'cape', id: 'carnet_naturaliste', name: 'Cape « Naturaliste »' },
  { what: 'stars', n: 1, kind: 'ach', id: 'etoile_celebre', name: 'Succès « Une étoile du ciel de la Terre »' },
  { what: 'stars', n: 5, kind: 'cape', id: 'carnet_etoiles', name: 'Cape « Chasseur d\'étoiles »' },
  { what: 'stars', n: 10, kind: 'ach', id: 'etoiles_celebres', name: 'Succès « Les phares de la galaxie »' },
  { what: 'stars', n: FAMOUS.length, kind: 'ach', id: 'toutes_etoiles', name: 'Succès « Toutes les étoiles »' },
];
// (les noms des plans, pour le livre de recettes)
export const PLAN_NAMES = Object.fromEntries(MILESTONES.filter((m) => m.kind === 'plan').map((m) => [m.id, m.name]));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class Journal {
  constructor() {
    this.reset();
    this.onReward = null;  // (milestone) : une récompense obtenue (main.js : succès, cape, message)
    this.onChange = null;  // (le monde a changé : à sauvegarder)
    this.el = null;
    this.tab = 'biomes';
  }
  reset() {
    this.biomes = {};   // clé -> { d (jour), b (planète) }
    this.seen = {};     // clé -> 1 (repéré par scan)
    this.bodies = {};   // id -> { d, n (nom), sys (nom du système), st (style), fav, scan (0, 1, 2), bi: [noms] }
    this.systems = {};  // id -> { d, n }
    this.stars = {};    // id -> d
    this.notes = {};    // 'b:id', 's:id', 'm:clé' -> texte
    this.plans = [];
    this.scanned = new Set(); // cases de SCAN_CELL blocs scannées ('x,z')
    this.ores = [];     // gisements repérés : { x, z, id (bloc), b (planète) }
    this.life = {};     // clé -> { d, k ('faune', 'flore', 'microbe', 'eco'), n (nom), b (planète), h (où), t (texte) }
  }

  // ---------- Sauvegarde ----------
  serialize() {
    return {
      v: 1, biomes: this.biomes, seen: this.seen, bodies: this.bodies, systems: this.systems, stars: this.stars,
      notes: this.notes, plans: this.plans, scan: [...this.scanned].join(';'), ores: this.ores.slice(0, 4000), life: this.life,
    };
  }
  load(d) {
    this.reset();
    if (!d || typeof d !== 'object') return;
    const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
    this.biomes = obj(d.biomes); this.seen = obj(d.seen); this.bodies = obj(d.bodies); this.systems = obj(d.systems); this.stars = obj(d.stars);
    this.notes = {};
    for (const [k, v] of Object.entries(obj(d.notes))) if (typeof v === 'string') this.notes[k] = v.slice(0, NOTE_MAX);
    this.plans = Array.isArray(d.plans) ? d.plans.filter((p) => typeof p === 'string') : [];
    this.scanned = new Set(typeof d.scan === 'string' && d.scan ? d.scan.split(';').filter((k) => /^-?\d+,-?\d+$/.test(k)) : []);
    this.ores = Array.isArray(d.ores) ? d.ores.filter((o) => o && Number.isFinite(o.x) && Number.isFinite(o.z) && Number.isFinite(o.id)) : [];
    for (const [k, v] of Object.entries(obj(d.life))) if (v && typeof v.n === 'string' && typeof v.k === 'string') this.life[k] = { d: +v.d || 0, k: v.k, n: v.n.slice(0, 80), b: String(v.b || ''), h: String(v.h || '').slice(0, 80), t: String(v.t || '').slice(0, 400) };
  }
  // Une forme de vie découverte (voir xenolife.js, microbes.js) : vrai si elle est nouvelle
  discoverLife(key, e, day) {
    if (!key || this.life[key]) return false;
    this.life[key] = { d: Math.floor(day), k: e.k, n: e.n, b: e.b || '', h: e.h || '', t: e.t || '' };
    this.onChange?.();
    if (this.el && this.tab === 'life') this.render();
    return true;
  }
  // Le microscope : l'échantillon s'affiche en haut de l'onglet Vie
  showSample(s, where) { this.sample = s; this.sampleAt = where || ''; this.tab = 'life'; }

  // ---------- Compteurs ----------
  get biomeCount() { let n = 0; for (const k in this.biomes) if (ALL_KEYS.has(k)) n++; return n; }
  get starCount() { let n = 0; for (const k in this.stars) if (FAMOUS_IDS.has(k)) n++; return n; }
  count(what) { return what === 'stars' ? this.starCount : this.biomeCount; }
  hasPlan(id) { return this.plans.includes(id); }

  // ---------- Découvertes ----------
  // Un biome où l'on marche : style (celui de la planète, « hexa » pour Hexa), nom, la planète (body) ; vrai s'il est nouveau
  discoverBiome(style, name, body, day) {
    if (!name) return false;
    const key = style + ':' + name;
    if (body) {
      const B = this.visitBody(body, day);
      if (B && !B.bi.includes(name)) { B.bi.push(name); this.onChange?.(); }
    }
    if (this.biomes[key]) return false;
    this.biomes[key] = { d: Math.floor(day), b: body?.id || 'hexa' };
    this.onChange?.();
    this.check();
    return true;
  }
  // Une planète (où l'on a marché, ou qu'on a scannée) : sa fiche
  visitBody(body, day, sysName = '') {
    if (!body) return null;
    let B = this.bodies[body.id];
    if (!B) {
      B = this.bodies[body.id] = { d: Math.floor(day), n: body.name, sys: sysName, st: body.gen?.style || '', fav: false, scan: 0, bi: [] };
      this.onChange?.();
    }
    if (sysName && !B.sys) B.sys = sysName;
    if (!Array.isArray(B.bi)) B.bi = [];
    return B;
  }
  // Un système stellaire atteint (sys : son astre central) ; vrai s'il est nouveau
  visitSystem(sys, day) {
    if (!sys || this.systems[sys.id]) return false;
    this.systems[sys.id] = { d: Math.floor(day), n: sys.name };
    if (FAMOUS_IDS.has(sys.id) || gxIndex(sys.id) >= 0 && GFAMOUS[gxIndex(sys.id)]) this.stars[sys.id] = Math.floor(day);
    this.onChange?.();
    this.check();
    return true;
  }
  // Les récompenses obtenues depuis la dernière fois (plans du monde ; succès et capes : main.js)
  check() {
    for (const m of MILESTONES) {
      if (this.count(m.what) < m.n) continue;
      if (m.kind === 'plan') { if (this.hasPlan(m.id)) continue; this.plans.push(m.id); this.onChange?.(); }
      this.onReward?.(m);
    }
  }
  // Le résultat d'un scan (voir main.js, scan) : cases, biomes repérés, gisements
  addScan(body, tier, res, day, sysName) {
    const B = this.visitBody(body, day, sysName);
    if (B) B.scan = Math.max(B.scan || 0, tier);
    for (const k of res.cells) this.scanned.add(k);
    for (const k of res.biomes) if (!this.biomes[k]) this.seen[k] = 1;
    // (un gisement par case de 512 blocs, pas deux fois)
    const have = new Set(this.ores.map((o) => Math.floor(o.x / 512) + ',' + Math.floor(o.z / 512) + ',' + o.id));
    let n = 0;
    for (const o of res.ores) {
      const k = Math.floor(o.x / 512) + ',' + Math.floor(o.z / 512) + ',' + o.id;
      if (have.has(k)) continue;
      have.add(k);
      this.ores.push({ ...o, b: body.id });
      n++;
    }
    this.onChange?.();
    return n;
  }

  // ---------- La fenêtre ----------
  // root : l'élément où dessiner ; ctx : { name(id) (nom d'un bloc), planetLegend(body), body(id), here (id de la planète où l'on est) }
  open(root, ctx) {
    this.el = root;
    this.ctx = ctx;
    this.render();
  }
  close() {
    this.stopScope?.(); this.stopScope = null; this.sample = null;
    if (this.el) this.el.innerHTML = '';
    this.el = null;
  }
  render() {
    const root = this.el;
    if (!root) return;
    const nb = this.biomeCount, ns = this.starCount;
    root.innerHTML = `<div class="jn-head"><h2>Carnet d'exploration</h2>
      <div class="jn-sum">Biomes : <b>${nb}</b> / ${BIOME_TOTAL} · Planètes : <b>${Object.keys(this.bodies).length}</b> · Systèmes : <b>${Object.keys(this.systems).length}</b> · Étoiles célèbres : <b>${ns}</b> / ${FAMOUS.length}</div>
      <div class="jn-tabs">${[['biomes', 'Biomes'], ['planets', 'Planètes'], ['systems', 'Systèmes et étoiles'], ['life', 'Vie (' + Object.keys(this.life).length + ')'], ['rewards', 'Récompenses']]
        .map(([k, t]) => `<button data-tab="${k}" class="${this.tab === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
      <div class="jn-body"></div><div class="jn-foot">Échap : fermer · les descriptions s'enregistrent toutes seules</div>`;
    root.querySelectorAll('.jn-tabs button').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.tab; this.render(); }));
    const body = root.querySelector('.jn-body');
    this.stopScope?.(); this.stopScope = null;
    if (this.tab === 'biomes') this.renderBiomes(body);
    else if (this.tab === 'life') this.renderLife(body);
    else if (this.tab === 'planets') this.renderPlanets(body);
    else if (this.tab === 'systems') this.renderSystems(body);
    else this.renderRewards(body);
  }
  // (une zone de texte : la description du joueur, enregistrée à chaque frappe)
  noteBox(key, placeholder) {
    const t = document.createElement('textarea');
    t.className = 'jn-note';
    t.maxLength = NOTE_MAX;
    t.placeholder = placeholder;
    t.value = this.notes[key] || '';
    t.addEventListener('input', () => { if (t.value.trim()) this.notes[key] = t.value.slice(0, NOTE_MAX); else delete this.notes[key]; this.onChange?.(); });
    t.addEventListener('keydown', (e) => e.stopPropagation());
    return t;
  }
  renderBiomes(el) {
    for (const S of [...CATALOG, HEXA_BIOMES]) {
      const got = S.list.filter((B) => this.biomes[B.key]).length;
      const sec = document.createElement('div');
      sec.className = 'jn-sec';
      sec.innerHTML = `<h3>${esc(S.title)} <span>${got} / ${S.list.length}</span></h3>`;
      const grid = document.createElement('div');
      grid.className = 'jn-grid';
      for (const B of S.list) {
        const has = this.biomes[B.key], seen = this.seen[B.key], chip = document.createElement('div');
        chip.className = 'jn-chip' + (has ? ' has' : seen ? ' seen' : '');
        chip.innerHTML = has || seen ? `<i style="background:${B.c}"></i>${esc(B.n)}${this.notes['m:' + B.key] ? ' ✎' : ''}` : '<i></i>???';
        chip.title = has ? `Découvert le jour ${has.d + 1}${has.b && this.ctx?.body(has.b) ? ' sur ' + this.ctx.body(has.b).name : ''} — clic : ta description` : seen ? 'Repéré par le scanner : marche dessus pour le cocher' : 'Pas encore découvert';
        if (has) chip.addEventListener('click', () => {
          const open = grid.querySelector('.jn-note');
          if (open) open.remove();
          if (open?.dataset.k === B.key) return;
          const t = this.noteBox('m:' + B.key, `Ta description de « ${B.n} »...`);
          t.dataset.k = B.key;
          t.style.gridColumn = '1 / -1';
          chip.after(t);
          t.focus();
        });
        grid.append(chip);
      }
      sec.append(grid);
      el.append(sec);
    }
  }
  renderPlanets(el) {
    const ids = Object.keys(this.bodies);
    if (!ids.length) { el.innerHTML = '<p class="jn-empty">Pose le pied sur une autre planète (ou scanne-la depuis l\'orbite) : elle aura sa page ici.</p>'; return; }
    ids.sort((a, b) => (this.bodies[b].fav ? 1 : 0) - (this.bodies[a].fav ? 1 : 0) || this.bodies[a].d - this.bodies[b].d);
    for (const id of ids) {
      const B = this.bodies[id], body = this.ctx?.body(id), legend = body ? this.ctx.planetLegend(body).filter((x) => !x.fluid) : [];
      const card = document.createElement('div');
      card.className = 'jn-card' + (B.fav ? ' fav' : '') + (this.ctx?.here === id ? ' here' : '');
      const found = legend.filter((x) => B.bi.includes(x.n)).length;
      card.innerHTML = `<div class="jn-ct"><button class="jn-star" title="${B.fav ? 'Retirer des favorites' : 'Mettre en favorite'}">${B.fav ? '★' : '☆'}</button>
        <b>${esc(B.n)}</b><span>${esc(B.sys || '')}${B.st ? ' · ' + esc(styleTitle(B.st)) : ''}${this.ctx?.here === id ? ' · tu y es' : ''}</span></div>
        <div class="jn-cl">Première visite : jour ${B.d + 1} · biomes trouvés : ${found} / ${legend.length || '?'}${B.scan ? ` · scannée (scanner ${B.scan === 2 ? 'II' : 'I'})` : ''}${body?.temp !== undefined ? ` · ${Math.round(body.temp)} °C` : ''}</div>
        <div class="jn-bi">${legend.map((x) => `<span class="${B.bi.includes(x.n) ? 'has' : ''}"><i style="background:${x.c}"></i>${B.bi.includes(x.n) || this.seen[(B.st || '') + ':' + x.n] ? esc(x.n) : '???'}</span>`).join('')}</div>`;
      card.querySelector('.jn-star').addEventListener('click', () => { B.fav = !B.fav; this.onChange?.(); this.render(); });
      card.append(this.noteBox('b:' + id, `Ta description de ${B.n} : ce que tu y as vu, où est ta base, ce qu'il faut y rapporter...`));
      el.append(card);
    }
  }
  renderSystems(el) {
    const st = document.createElement('div');
    st.className = 'jn-sec';
    st.innerHTML = `<h3>Étoiles célèbres <span>${this.starCount} / ${FAMOUS.length}</span></h3>`;
    const grid = document.createElement('div');
    grid.className = 'jn-grid';
    for (const S of FAMOUS) {
      const d = this.stars[S.id];
      grid.insertAdjacentHTML('beforeend', `<div class="jn-chip${d !== undefined ? ' has' : ''}" title="${d !== undefined ? 'Atteinte le jour ' + (d + 1) : 'Pas encore atteinte (N en vol : choisir une destination)'}"><i style="background:${d !== undefined ? '#ffd060' : ''}"></i>${esc(S.n)}</div>`);
    }
    st.append(grid);
    el.append(st);
    const sy = document.createElement('div');
    sy.className = 'jn-sec';
    const ids = Object.keys(this.systems).sort((a, b) => this.systems[a].d - this.systems[b].d);
    sy.innerHTML = `<h3>Systèmes visités <span>${ids.length}</span></h3>`;
    if (!ids.length) sy.insertAdjacentHTML('beforeend', '<p class="jn-empty">Aucun pour l\'instant : décolle !</p>');
    for (const id of ids) {
      const S = this.systems[id], row = document.createElement('div');
      row.className = 'jn-card';
      row.innerHTML = `<div class="jn-ct"><b>${esc(S.n)}</b><span>jour ${S.d + 1}${this.stars[id] !== undefined ? ' · étoile célèbre' : ''}</span></div>`;
      row.append(this.noteBox('s:' + id, `Ta description du système ${S.n}...`));
      sy.append(row);
    }
    el.append(sy);
  }
  renderLife(el) {
    // (le microscope : l'échantillon qu'on vient de regarder)
    if (this.sample) {
      const S = this.sample, box = document.createElement('div');
      box.className = 'jn-scope';
      box.innerHTML = `<canvas width="220" height="220"></canvas><div><h3>${esc(S.name)}</h3><div class="jn-cl">${esc(this.sampleAt)}${S.habitat ? ' · ' + esc(S.habitat) : ''}</div><p>${esc(S.text)}</p></div>`;
      el.append(box);
      this.stopScope = drawMicroscope(box.querySelector('canvas'), S);
    }
    const all = Object.entries(this.life);
    if (!all.length && !this.sample) { el.innerHTML = '<p class="jn-empty">Aucune forme de vie notée. Approche-toi des créatures et des plantes des autres mondes, et regarde le sol au microscope (clic droit sur un bloc, le microscope en main).</p>'; return; }
    for (const [k, t] of [['faune', 'Faune'], ['flore', 'Flore'], ['microbe', 'Microbes'], ['eco', 'Écologie']]) {
      const list = all.filter(([, v]) => v.k === k).sort((a, b) => a[1].d - b[1].d);
      if (!list.length) continue;
      const sec = document.createElement('div');
      sec.className = 'jn-sec';
      sec.innerHTML = `<h3>${t} <span>${list.length}</span></h3>`;
      for (const [key, v] of list) {
        const card = document.createElement('div'), body = this.ctx?.body(v.b);
        card.className = 'jn-card';
        card.innerHTML = `<div class="jn-ct"><b>${esc(v.n)}</b><span>${body ? esc(body.name) : ''}${v.h ? ' · ' + esc(v.h) : ''} · jour ${v.d + 1}</span></div>${v.t ? `<div class="jn-cl">${esc(v.t)}</div>` : ''}`;
        card.append(this.noteBox('l:' + key, 'Tes observations...'));
        sec.append(card);
      }
      el.append(sec);
    }
  }
  renderRewards(el) {
    const sec = document.createElement('div');
    sec.className = 'jn-sec';
    sec.innerHTML = '<h3>Récompenses</h3><p class="jn-empty">Les succès et les capes vont à ton compte (connecté, en survie) ; les plans débloquent leur recette dans ce monde.</p>';
    for (const m of MILESTONES) {
      const n = this.count(m.what), done = n >= m.n, row = document.createElement('div');
      row.className = 'jn-rw' + (done ? ' done' : '');
      row.innerHTML = `<span class="jn-kind">${{ ach: 'Succès', plan: 'Plan', cape: 'Cape' }[m.kind]}</span><b>${esc(m.name.replace(/^(Succès|Plan|Cape) :? ?/, ''))}</b>
        <span class="jn-req">${m.n} ${m.what === 'stars' ? (m.n > 1 ? 'étoiles célèbres' : 'étoile célèbre') : m.n > 1 ? 'biomes' : 'biome'}</span>
        <span class="jn-bar"><i style="width:${Math.min(100, (n / m.n) * 100)}%"></i></span><span class="jn-st">${done ? '✔' : n + ' / ' + m.n}</span>`;
      sec.append(row);
    }
    el.append(sec);
  }
}

// ---------- Le scan ----------
// Les cases de SCAN_CELL blocs à moins de R de (x, z), et pour chacune son biome (gen.mapBiomeDef) :
// { cells: ['x,z'], biomes: Set(clé), ores: [{ x, z, id }] } ; style : celui de la planète
export function scanArea(gen, style, x, z, R) {
  const cells = [], biomes = new Set(), ores = [];
  const cx = Math.floor(x / SCAN_CELL), cz = Math.floor(z / SCAN_CELL), n = Math.ceil(R / SCAN_CELL);
  for (let a = -n; a <= n; a++) {
    for (let b = -n; b <= n; b++) {
      if (Math.hypot(a, b) * SCAN_CELL > R) continue;
      const gx = cx + a, gz = cz + b;
      cells.push(gx + ',' + gz);
      // (le centre de la case, en coordonnées hexagonales)
      const wx = (gx + 0.5) * SCAN_CELL, wz = (gz + 0.5) * SCAN_CELL, r = Math.round(wz / (Math.sqrt(3) / 2)), q = Math.round(wx - r / 2);
      const B = gen.mapBiomeDef?.(q, r);
      if (!B) continue;
      biomes.add(style + ':' + (B.n || B.name));
      if (B.ore) for (const [id] of B.ore) ores.push({ x: wx, z: wz, id });
    }
  }
  return { cells, biomes, ores };
}
