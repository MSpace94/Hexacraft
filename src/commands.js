// Les commandes /setblock, /fill, /say et /scoreboard : mêmes syntaxes et mêmes options que dans
// Minecraft (coordonnées ~ et ^, états de blocs [..], données {..}, sélecteurs @a[..], textes
// JSON, tous les sous-commandes du tableau des scores).
//
// La carte est faite d'hexagones : x et z sont ceux de F3, et chaque position désigne la case qui
// la contient. /fill remplit les cases dont le centre est dans le rectangle entre les deux coins.
//
// Multijoueur : c'est l'hôte qui lance ces commandes et qui tient le tableau des scores ; les
// invités reçoivent ce qui est affiché (voir view) et lui disent leur vie, leur faim, leurs morts.
import { BLOCKS, ITEMS, AIR, WATER, ICE_WATER, WIRE, IWIRE, FURNACE, FURNACE_ON, PHYSICS, PHYSICS_ON, POWERED_RAIL, POWERED_RAIL_OFF, DIAMOND_RAIL, DIAMOND_RAIL_OFF, WHEAT_CROP, WHEAT_RIPE, POTATO_CROP, POTATO_RIPE, WALL_TORCH, isWater, isLava, isWire, isRepeater, isWallTorch, repeaterState, repeaterKind, wireState, isRepeaterOn, flowId, fallId, isIceWater, makeSlot } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { NEIGHBORS, hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mwgq2wrb';
import { SPECIES } from './animals.js?v=1.1.5-alpha-mwgq2wrb';
import { dropOf, stackMax } from './survival.js?v=1.1.5-alpha-mwgq2wrb';
import EN from './lang/en.js?v=1.1.5-alpha-mwgq2wrb';

const LIMIT = 32768; // (comme la règle commandModificationBlockLimit de Minecraft)
const INT_MAX = 2147483647, INT_MIN = -2147483648;
const COLORS = {
  black: '#000000', dark_blue: '#0000aa', dark_green: '#00aa00', dark_aqua: '#00aaaa', dark_red: '#aa0000', dark_purple: '#aa00aa', gold: '#ffaa00', gray: '#aaaaaa',
  dark_gray: '#555555', blue: '#5555ff', green: '#55ff55', aqua: '#55ffff', red: '#ff5555', light_purple: '#ff55ff', yellow: '#ffff55', white: '#ffffff',
};
const READ_ONLY = new Set(['health', 'food', 'air', 'armor', 'xp', 'level']);
const SIMPLE_CRITERIA = ['dummy', 'trigger', 'deathCount', 'playerKillCount', 'totalKillCount', ...READ_ONLY];
const STAT_TYPES = ['custom', 'mined', 'broken', 'crafted', 'used', 'picked_up', 'dropped', 'killed', 'killed_by'];
const CUSTOM_STATS = ['deaths', 'player_kills', 'mob_kills', 'jump', 'play_time', 'walk_one_cm', 'sprint_one_cm', 'swim_one_cm', 'fly_one_cm', 'damage_taken', 'damage_dealt', 'time_since_death', 'interact_with_crafting_table'];
const OPS = ['+=', '-=', '*=', '/=', '%=', '=', '<', '>', '><'];

class CmdError extends Error {}
const fail = (m) => { throw new CmdError(m); };
const slug = (s) => String(s).toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const unNs = (s) => s.replace(/^hexacraft[:.]/, '');

// ---------- Les noms des blocs et des objets ----------
// Chaque bloc a son nom en français et en anglais (planches_de_chene, oak_planks) ; le préfixe
// hexacraft: est accepté, comme le numéro du bloc
const ALIASES = { air: AIR, grass_block: 1, dirt: 2, stone: 3, bedrock: 4, oak_log: 5, oak_leaves: 6, water: WATER, sand: 8, rail: 17, oak_planks: 18, powered_rail: POWERED_RAIL, torch: 23, tnt: 26, crafting_table: 31, glass: 40, furnace: FURNACE, chest: 54, iron_ore: 60, iron_block: 62, basalt: 68, tuff: 71, lava: 72, magma_block: 73, obsidian: 74 };
let blockNames = null, itemNames = null, shownBlocks = null, shownItems = null;
function registry() {
  if (blockNames) return;
  blockNames = new Map([['air', AIR], ['air_vide', AIR]]);
  itemNames = new Map();
  shownBlocks = new Set(['air']);
  shownItems = new Set();
  const usable = (id) => BLOCKS[id]?.name && !ITEMS[id]?.train;
  const ids = Object.keys(BLOCKS).map(Number).filter(usable).sort((a, b) => (!!BLOCKS[a].hidden - !!BLOCKS[b].hidden) || a - b);
  const add = (map, shown, id, b) => {
    for (const n of [slug(b.name), EN[b.name] ? slug(EN[b.name]) : '']) {
      if (!n) continue;
      if (!map.has(n)) map.set(n, id);
      if (!b.hidden) shown.add(n);
    }
  };
  for (const id of ids) { add(blockNames, shownBlocks, id, BLOCKS[id]); add(itemNames, shownItems, id, BLOCKS[id]); }
  for (const [n, id] of Object.entries(ALIASES)) { blockNames.set(n, id); shownBlocks.add(n); if (id) { itemNames.set(n, id); shownItems.add(n); } }
  for (const id of Object.keys(ITEMS).map(Number)) if (ITEMS[id]?.name) add(itemNames, shownItems, id, ITEMS[id]);
}
const blockId = (s) => { registry(); const n = unNs(s.toLowerCase()); if (blockNames.has(n)) return blockNames.get(n); return /^\d+$/.test(n) && BLOCKS[+n] ? +n : (n === '0' ? AIR : null); };
const itemId = (s) => { registry(); const n = unNs(String(s).toLowerCase()); if (itemNames.has(n)) return itemNames.get(n); return /^\d+$/.test(n) && (BLOCKS[+n] || ITEMS[+n]) ? +n : null; };
const nameOf = (id) => (id === AIR ? 'Air' : isWater(id) ? BLOCKS[isIceWater(id) ? ICE_WATER : WATER].name : isLava(id) ? BLOCKS[72].name : BLOCKS[id]?.name || '?');

const TAGS = {
  logs: (b) => b.log, leaves: (b) => b.leaves, rails: (b) => b.rail, slabs: (b) => b.slab,
  planks: (b) => /planches|planks/i.test(b.name), ores: (b) => /minerai/i.test(b.name), wool: (b) => /laine/i.test(b.name),
  sand: (b) => /^sable/i.test(b.name), dirt: (b, id) => id === 1 || id === 2, glass: (b) => /^(verre|vitre)/i.test(b.name),
  containers: (b) => b.container,
};
TAGS.ice = (b) => /^glace/i.test(b.name);
TAGS.base_stone_overworld = (b, id) => id === 3 || /^(diorite|granite|andésite|tuf)/i.test(b.name);
const TAG_FLUID = { water: isWater, lava: isLava };

// La « famille » d'un bloc : toutes ses variantes (orientation, allumé, niveau)
function familyOf(id) {
  const b = BLOCKS[id];
  if (isWater(id)) return isIceWater(id) ? ICE_WATER : WATER;
  if (isLava(id)) return 72;
  if (isRepeater(id)) return (id >= 170 && id < 194 ? 'inv' : 'rep') + repeaterKind(id);
  if (isWire(id)) return wireState(id, false);
  if (isWallTorch(id)) return WALL_TORCH;
  if (id === FURNACE_ON) return FURNACE;
  if (id === PHYSICS_ON) return PHYSICS;
  if (id === POWERED_RAIL_OFF) return POWERED_RAIL;
  if (id === DIAMOND_RAIL_OFF) return DIAMOND_RAIL;
  if (id >= WHEAT_CROP && id <= WHEAT_RIPE) return WHEAT_CROP;
  if (id >= POTATO_CROP && id <= POTATO_RIPE) return POTATO_CROP;
  if (b?.placedAs) return b.placedAs;
  if (b?.base !== undefined) return 'b' + b.base;
  return id;
}

// Les 6 côtés d'une case : les points cardinaux de Minecraft donnent le côté le plus proche
function sideOf(v) {
  if (/^[0-5]$/.test(v)) return +v;
  const dir = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[v];
  if (!dir) return -1;
  let best = 0, top = -2;
  NEIGHBORS.forEach(([dq, dr], k) => {
    const w = hexToWorld(dq, dr), l = Math.hypot(w.x, w.z), d = (w.x * dir[0] + w.z * dir[1]) / l;
    if (d > top) { top = d; best = k; }
  });
  return best;
}
const bool = (v, p) => (v === 'true' ? true : v === 'false' ? false : fail(`Valeur « ${v} » invalide pour la propriété ${p}`));

// L'id du bloc avec ces états [facing=2,powered=true]
function withStates(id, props, label) {
  const bad = (p) => fail(`Le bloc ${label} n'a pas la propriété « ${p} »`);
  for (const [p, v] of Object.entries(props)) {
    const b = BLOCKS[id];
    if (p === 'facing') {
      const k = sideOf(v);
      if (k < 0) fail(`Valeur « ${v} » invalide pour la propriété facing (0 à 5, north, south, east, west)`);
      if (b?.base !== undefined) id = b.base + k;
      else if (isWallTorch(id)) id = WALL_TORCH + k;
      else if (isRepeater(id)) id = id - ((id - (id >= 210 ? 210 : 170)) % 6) + k;
      else bad(p);
    } else if (p === 'powered' || p === 'lit') {
      const on = bool(v, p);
      if (isWire(id)) id = wireState(id, on);
      else if (isRepeater(id)) id = repeaterState(id, on);
      else if (id === FURNACE || id === FURNACE_ON) id = on ? FURNACE_ON : FURNACE;
      else if (id === PHYSICS || id === PHYSICS_ON) id = on ? PHYSICS_ON : PHYSICS;
      else if (id === POWERED_RAIL || id === POWERED_RAIL_OFF) id = on ? POWERED_RAIL : POWERED_RAIL_OFF;
      else if (id === DIAMOND_RAIL || id === DIAMOND_RAIL_OFF) id = on ? DIAMOND_RAIL : DIAMOND_RAIL_OFF;
      else bad(p);
    } else if (p === 'level') {
      const n = /^\d+$/.test(v) ? +v : -1;
      if (n < 0 || n > 15) fail(`Valeur « ${v} » invalide pour la propriété level (0 à 15)`);
      if (isWater(id)) { const ice = isIceWater(id); id = n === 0 ? (ice ? ICE_WATER : WATER) : n >= 8 ? fallId(ice) : flowId(7 - n, ice); }
      else if (isLava(id)) id = n === 0 ? 72 : n >= 8 ? 93 : 90 + Math.min(2, Math.floor((n - 1) / 3));
      else bad(p);
    } else if (p === 'age') {
      const n = /^\d+$/.test(v) ? +v : -1;
      const fam = familyOf(id), lo = fam === WHEAT_CROP ? WHEAT_CROP : fam === POTATO_CROP ? POTATO_CROP : -1, hi = fam === WHEAT_CROP ? WHEAT_RIPE : POTATO_RIPE;
      if (lo < 0) bad(p);
      if (n < 0 || lo + n > hi) fail(`Valeur « ${v} » invalide pour la propriété age (0 à ${hi - lo})`);
      id = lo + n;
    } else if (p === 'persistent') {
      if (!b?.leaves && !Object.values(BLOCKS).some((o) => o.placedAs === id)) bad(p);
      if (bool(v, p)) id = b?.placedAs || id;
      else { const nat = Object.keys(BLOCKS).find((k) => BLOCKS[k].placedAs === id); if (nat) id = +nat; }
    } else bad(p);
  }
  return id;
}

// ---------- Lecture de la ligne de commande ----------
class Reader {
  constructor(s) { this.s = s; this.i = 0; }
  ws() { while (this.s[this.i] === ' ') this.i++; }
  get more() { this.ws(); return this.i < this.s.length; }
  peek() { this.ws(); return this.s[this.i]; }
  rest() { this.ws(); const r = this.s.slice(this.i); this.i = this.s.length; return r; }
  word() { this.ws(); const a = this.i; while (this.i < this.s.length && this.s[this.i] !== ' ') this.i++; return this.s.slice(a, this.i); }
  need(what) { const w = this.word(); if (!w) fail(`Il manque ${what}`); return w; }
  end() { if (this.more) fail(`Données en trop à la fin de la commande : ${this.s.slice(this.i)}`); }
  // Un bloc entre crochets/accolades (en tenant compte des guillemets) ; s'arrête à la fermante
  balanced() {
    const a = this.i;
    let depth = 0, q = null;
    for (; this.i < this.s.length; this.i++) {
      const c = this.s[this.i];
      if (q) { if (c === '\\') this.i++; else if (c === q) q = null; continue; }
      if (c === '"' || c === '\'') q = c;
      else if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') { if (--depth === 0) { this.i++; return this.s.slice(a, this.i); } }
    }
    fail('Crochet ou accolade non fermé');
  }
  // Un nombre entier
  int(what, lo = INT_MIN, hi = INT_MAX) {
    const w = this.need(what);
    if (!/^[+-]?\d+$/.test(w)) fail(`Nombre entier attendu pour ${what} : ${w}`);
    const n = Number(w);
    if (n < lo || n > hi) fail(`${what} doit être entre ${lo} et ${hi} (reçu : ${w})`);
    return n;
  }
}

// SNBT : le format {cle:valeur} des données de Minecraft (le JSON en fait partie)
function parseSnbt(text) {
  let i = 0;
  const ws = () => { while (/\s/.test(text[i] || '')) i++; };
  const str = () => {
    const q = text[i++];
    let out = '';
    while (i < text.length && text[i] !== q) { if (text[i] === '\\') i++; out += text[i++]; }
    if (i >= text.length) fail('Guillemet non fermé');
    i++;
    return out;
  };
  const bare = () => { const a = i; while (i < text.length && /[0-9A-Za-z_\-.+]/.test(text[i])) i++; return text.slice(a, i); };
  const val = () => {
    ws();
    const c = text[i];
    if (c === '{') {
      i++;
      const o = {};
      for (;;) {
        ws();
        if (text[i] === '}') { i++; return o; }
        const k = text[i] === '"' || text[i] === '\'' ? str() : bare();
        if (!k) fail('Données {..} mal écrites : nom attendu');
        ws();
        if (text[i++] !== ':') fail('Données {..} mal écrites : « : » attendu');
        o[k] = val();
        ws();
        if (text[i] === ',') i++;
        else if (text[i] !== '}') fail('Données {..} mal écrites : « , » ou « } » attendu');
      }
    }
    if (c === '[') {
      i++;
      if (/^[BIL];/.test(text.slice(i, i + 2))) i += 2;
      const a = [];
      for (;;) {
        ws();
        if (text[i] === ']') { i++; return a; }
        a.push(val());
        ws();
        if (text[i] === ',') i++;
        else if (text[i] !== ']') fail('Liste [..] mal écrite : « , » ou « ] » attendu');
      }
    }
    if (c === '"' || c === '\'') return str();
    const w = bare();
    if (!w) fail('Données mal écrites');
    if (w === 'true') return true;
    if (w === 'false') return false;
    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?[bBsSlLfFdD]?$/.test(w)) return parseFloat(w);
    return w;
  };
  const v = val();
  ws();
  if (i < text.length) fail('Données mal écrites : texte en trop');
  return v;
}

// Un intervalle de sélecteur : 3, 1..5, ..5, 1..
function range(v, what) {
  const m = /^(-?\d*\.?\d*)(\.\.)?(-?\d*\.?\d*)$/.exec(v);
  if (!m || (!m[1] && !m[3])) fail(`Intervalle invalide pour ${what} : ${v}`);
  const lo = m[1] === '' ? -Infinity : Number(m[1]), hi = m[2] ? (m[3] === '' ? Infinity : Number(m[3])) : lo;
  if (lo > hi) fail(`Intervalle invalide pour ${what} : le minimum dépasse le maximum`);
  return [lo, hi];
}

// Les arguments d'un sélecteur (entre [ ]), coupés aux virgules du premier niveau
function selArgs(body, split = ',') {
  const out = [];
  let depth = 0, q = null, a = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === '\'') q = c;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
    else if (c === split && !depth) { out.push(body.slice(a, i)); a = i + 1; }
  }
  if (body.slice(a).trim()) out.push(body.slice(a));
  return out.map((s) => {
    const k = s.indexOf('=');
    if (k < 0) fail(`Argument de sélecteur invalide : ${s}`);
    let v = s.slice(k + 1).trim();
    const not = v[0] === '!';
    if (not) v = v.slice(1).trim();
    if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
    return { k: s.slice(0, k).trim(), v, not };
  });
}

// ---------- Texte (composants JSON de Minecraft) ----------
// Résultat : une liste de morceaux { t, c, b, i, u, s, o }
function styleOf(o, base = {}) {
  const st = { ...base };
  if (typeof o.color === 'string') {
    const c = COLORS[o.color] || (/^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : null);
    if (!c && o.color !== 'reset') fail(`Couleur inconnue : ${o.color}`);
    st.c = c || undefined;
  }
  for (const [k, n] of [['b', 'bold'], ['i', 'italic'], ['u', 'underlined'], ['s', 'strikethrough'], ['o', 'obfuscated']]) if (typeof o[n] === 'boolean') st[k] = o[n];
  return st;
}
const plain = (runs) => runs.map((r) => r.t).join('');

// ---------- Le tableau des scores ----------
class Scoreboard {
  constructor() { this.clear(); }
  clear() { this.objectives = new Map(); this.scores = new Map(); this.slots = {}; }
  serialize() {
    return {
      o: [...this.objectives.values()],
      s: [...this.scores].map(([h, m]) => [h, [...m]]),
      d: this.slots,
    };
  }
  load(d) {
    this.clear();
    if (!d || typeof d !== 'object') return;
    for (const o of Array.isArray(d.o) ? d.o : []) if (o && typeof o.name === 'string') this.objectives.set(o.name, o);
    for (const e of Array.isArray(d.s) ? d.s : []) if (Array.isArray(e) && typeof e[0] === 'string' && Array.isArray(e[1])) this.scores.set(e[0], new Map(e[1]));
    if (d.d && typeof d.d === 'object') this.slots = d.d;
  }
  entry(h, o, make = true) {
    let m = this.scores.get(h);
    if (!m) { if (!make) return null; this.scores.set(h, (m = new Map())); }
    let e = m.get(o);
    if (!e && make) m.set(o, (e = { v: 0, locked: true }));
    return e || null;
  }
  remove(name) {
    this.objectives.delete(name);
    for (const [h, m] of this.scores) { m.delete(name); if (!m.size) this.scores.delete(h); }
    for (const k of Object.keys(this.slots)) if (this.slots[k] === name) delete this.slots[k];
  }
  holdersOf(name) { return [...this.scores].filter(([, m]) => m.has(name)).map(([h, m]) => [h, m.get(name)]); }
}

export class Commands {
  // g : world, player, survival, animals, net, containers, fx, Y_MIN, chat(text, kind), playBreak(id),
  // dropAt(pos, stacks), viewChanged(), mode()
  constructor(g) {
    this.g = g;
    this.sb = new Scoreboard();
    this.clock = 0;
    this.lastView = '';
    this.shown = null;
    this.side = null;
    this.hintEl = null;
  }
  reset(data) {
    this.sb.load(data);
    this.lastView = '';
    this.applyView(null);
  }

  // ---------- Lancer une commande ----------
  run(text) {
    try {
      const r = new Reader(text.replace(/^\//, ''));
      const cmd = r.word().toLowerCase();
      if (cmd === 'setblock') this.setblock(r);
      else if (cmd === 'fill') this.fill(r);
      else if (cmd === 'say') this.say(r);
      else if (cmd === 'scoreboard') this.scoreboard(r);
    } catch (e) {
      if (!(e instanceof CmdError)) { console.error(e); this.g.chat('Erreur pendant la commande (voir la console)', 'err'); return; }
      this.g.chat(e.message, 'err');
    }
  }
  ok(m) { this.g.chat(m, 'sys'); }

  // ---------- Coordonnées ----------
  look() {
    const { yaw, pitch } = this.g.player, cp = Math.cos(pitch);
    const f = [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const up = [right[1] * f[2] - right[2] * f[1], right[2] * f[0] - right[0] * f[2], right[0] * f[1] - right[1] * f[0]];
    return { f, right, up };
  }
  // Trois coordonnées (~ relatives, ^ locales) : la case qui les contient
  pos(r) {
    const a = [r.need('une coordonnée x'), r.need('une coordonnée y'), r.need('une coordonnée z')];
    const locals = a.filter((c) => c[0] === '^').length;
    if (locals && locals !== 3) fail('On ne peut pas mélanger les coordonnées ^ avec les autres');
    const p = this.g.player.pos;
    let v;
    if (locals) {
      const n = a.map((c) => { const s = c.slice(1), x = s ? Number(s) : 0; if (!Number.isFinite(x)) fail(`Coordonnée invalide : ${c}`); return x; });
      const { f, right, up } = this.look();
      v = [0, 1, 2].map((i) => [p.x, p.y, p.z][i] - right[i] * n[0] + up[i] * n[1] + f[i] * n[2]);
    } else {
      v = a.map((c, i) => {
        const base = [p.x, p.y, p.z][i];
        if (c[0] === '~') { const n = c.length > 1 ? Number(c.slice(1)) : 0; if (!Number.isFinite(n)) fail(`Coordonnée invalide : ${c}`); return base + n; }
        if (!/^[+-]?\d+$/.test(c)) fail(`Nombre entier attendu pour une coordonnée : ${c}`);
        return Number(c);
      });
    }
    const { q, r: rr } = worldToHex(v[0], v[2]);
    return { q, r: rr, y: Math.floor(v[1] + 0.001) };
  }
  at(c) { const w = hexToWorld(c.q, c.r); return `${w.x.toFixed(1)}, ${c.y}, ${w.z.toFixed(1)}`; }

  // ---------- Blocs ----------
  block(r, allowTag) {
    r.ws();
    const a = r.i;
    while (r.i < r.s.length && !' [{'.includes(r.s[r.i])) r.i++;
    const name = r.s.slice(a, r.i);
    if (!name) fail('Il manque le bloc');
    const out = { name };
    if (name[0] === '#') {
      if (!allowTag) fail('Un tag (#) n\'est pas accepté ici : il faut un bloc');
      const t = unNs(name.slice(1).toLowerCase());
      if (!TAGS[t] && !TAG_FLUID[t]) fail(`Tag de blocs inconnu : ${name}`);
      out.tag = t;
    } else {
      out.id = blockId(name);
      if (out.id === null) fail(`Bloc inconnu : ${name}`);
    }
    out.props = {};
    if (r.s[r.i] === '[') {
      const body = r.balanced().slice(1, -1);
      for (const { k, v } of selArgs(body)) out.props[k] = v;
    }
    if (out.id !== undefined) out.state = withStates(out.id, out.props, name);
    if (r.s[r.i] === '{') out.nbt = parseSnbt(r.balanced());
    return out;
  }
  // Ce bloc correspond-il au filtre de /fill ... replace <filtre> ?
  matches(f, id) {
    if (f.tag) {
      if (TAG_FLUID[f.tag]) return TAG_FLUID[f.tag](id);
      const b = BLOCKS[id];
      return !!b && !!TAGS[f.tag](b, id);
    }
    if (Object.keys(f.props).length) return id === f.state;
    return familyOf(id) === familyOf(f.state);
  }
  // Les objets {Items:[{Slot:0b,id:"stone",count:3}]} d'un coffre, d'un four
  applyNbt(q, r, y, nbt) {
    if (!nbt || !Array.isArray(nbt.Items)) return;
    const { containers, net } = this.g, c = containers.at(q, r, y);
    if (!c) return;
    const slot = (it) => {
      const id = itemId(it.id ?? '');
      if (id === null) fail(`Objet inconnu : ${it.id}`);
      const n = Number(it.count ?? it.Count ?? 1);
      return makeSlot(id, Math.max(1, Math.min(stackMax(id), Math.floor(n) || 1)));
    };
    if (c.type === 'chest') {
      c.slots.fill(null);
      for (const it of nbt.Items) { const i = Number(it?.Slot ?? -1); if (i >= 0 && i < c.slots.length) c.slots[i] = slot(it); }
    } else {
      c.input = c.fuel = c.output = null;
      for (const it of nbt.Items) { const k = ['input', 'fuel', 'output'][Number(it?.Slot ?? -1)]; if (k) c[k] = slot(it); }
    }
    if (net.isHost) net.pushBox(q + ',' + r + ',' + y);
  }
  // Détruire comme un joueur : éclats, bruit, ce qu'il donne et ce qu'il contenait
  destroy(q, r, y, id, fx) {
    const { containers, dropAt, playBreak } = this.g, c = hexToWorld(q, r);
    if (fx) { this.g.fx.breakBlock(c.x, y, c.z, id); playBreak(id); }
    const stacks = [];
    if (BLOCKS[id]?.container) stacks.push(...containers.take(q, r, y));
    const d = isWater(id) || isLava(id) ? null : dropOf(id, 0);
    if (d) stacks.push({ id: d[0], n: d[1] || 1 });
    if (stacks.length) dropAt({ x: c.x, y, z: c.z }, stacks);
  }

  // ---------- /setblock <pos> <bloc> [destroy|keep|replace|strict] ----------
  setblock(r) {
    const c = this.pos(r), b = this.block(r, false), mode = (r.more ? r.word() : 'replace').toLowerCase();
    if (!['destroy', 'keep', 'replace', 'strict'].includes(mode)) fail(`Option inconnue : ${mode} (destroy, keep, replace ou strict)`);
    r.end();
    const { world, Y_MIN } = this.g;
    if (c.y < Y_MIN) fail('Impossible de poser un bloc hors du monde');
    const old = world.getBlock(c.q, c.r, c.y);
    if ((mode === 'keep' && old !== AIR) || (old === b.state && !b.nbt)) fail('Impossible de poser le bloc');
    if (mode === 'destroy' && old !== AIR) this.destroy(c.q, c.r, c.y, old, true);
    world.setBlock(c.q, c.r, c.y, b.state, mode === 'strict');
    this.applyNbt(c.q, c.r, c.y, b.nbt);
    this.ok(`Bloc modifié en ${this.at(c)} : ${nameOf(b.state)}`);
  }

  // ---------- /fill <de> <à> <bloc> [destroy|hollow|keep|outline|replace [filtre]|strict] ----------
  fill(r) {
    const a = this.pos(r), b = this.pos(r), blk = this.block(r, false), mode = (r.more ? r.word() : 'replace').toLowerCase();
    if (!['destroy', 'hollow', 'keep', 'outline', 'replace', 'strict'].includes(mode)) fail(`Option inconnue : ${mode} (destroy, hollow, keep, outline, replace ou strict)`);
    const filter = mode === 'replace' && r.more ? this.block(r, true) : null;
    r.end();
    const { world, Y_MIN } = this.g;
    if (Math.min(a.y, b.y) < Y_MIN) fail('Impossible de poser des blocs hors du monde');
    const ay = Math.min(a.y, b.y), by = Math.max(a.y, b.y), r0 = Math.min(a.r, b.r), r1 = Math.max(a.r, b.r);
    const wa = hexToWorld(a.q, a.r), wb = hexToWorld(b.q, b.r), x0 = Math.min(wa.x, wb.x), x1 = Math.max(wa.x, wb.x);
    // (rangée par rangée : les cases dont le centre est entre les deux coins)
    const q0of = (rr) => Math.ceil(x0 - 0.5 - rr / 2 + 1e-6), q1of = (rr) => Math.floor(x1 + 0.5 - rr / 2 - 1e-6);
    // (d'abord une estimation : la zone peut compter des milliards de rangées)
    let total = (r1 - r0 + 1) * (Math.round(x1 - x0) + 1) * (by - ay + 1);
    if (total <= LIMIT * 2) { total = 0; for (let rr = r0; rr <= r1; rr++) total += (q1of(rr) - q0of(rr) + 1) * (by - ay + 1); }
    if (total > LIMIT) fail(`Trop de blocs dans la zone (au plus ${LIMIT}, demandés : ${total})`);
    let n = 0, sparks = 0;
    for (let y = ay; y <= by; y++) {
      for (let rr = r0; rr <= r1; rr++) {
        const q0 = q0of(rr), q1 = q1of(rr);
        for (let q = q0; q <= q1; q++) {
          const shell = y === ay || y === by || rr === r0 || rr === r1 || q === q0 || q === q1;
          if (mode === 'outline' && !shell) continue;
          const old = world.getBlock(q, rr, y);
          if (mode === 'keep' && old !== AIR) continue;
          if (filter && !this.matches(filter, old)) continue;
          const id = mode === 'hollow' && !shell ? AIR : blk.state;
          if (old === id && !blk.nbt) continue;
          if (mode === 'destroy' && old !== AIR) this.destroy(q, rr, y, old, sparks++ < 48);
          world.setBlock(q, rr, y, id, mode === 'strict');
          if (id === blk.state) this.applyNbt(q, rr, y, blk.nbt);
          n++;
        }
      }
    }
    if (!n) fail('Aucun bloc n\'a été rempli');
    this.ok(`${n} bloc${n > 1 ? 's' : ''} rempli${n > 1 ? 's' : ''} : ${nameOf(blk.state)}`);
  }

  // ---------- Entités et sélecteurs ----------
  me() { const { name, player, mode } = this.g; return { name: name(), pos: player.pos, yaw: player.yaw, pitch: player.pitch, mode: mode(), player: true, self: true }; }
  players() {
    const { net } = this.g, out = [this.me()];
    if (net.isHost) {
      for (const c of net.clients.values()) {
        if (!c.joined) continue;
        out.push({ name: c.name, pos: c.proxy.pos, yaw: c.proxy.yaw, pitch: c.proxy.pitch, mode: c.proxy.sb?.m || 'survival', player: true });
      }
    }
    return out;
  }
  mobs() {
    return this.g.animals.list.filter((a) => !a.dead).map((a) => ({ name: SPECIES[a.type]?.name || a.type, holder: `${a.type}-${a.id}`, type: a.type, pos: a.pos, yaw: a.yaw || 0, pitch: 0, mode: null }));
  }
  // Un sélecteur @p, @a[..] au point où en est le lecteur : les entités trouvées
  selector(r) {
    r.ws();
    const kind = r.s[r.i + 1];
    if (!'aeprsn'.includes(kind || ' ')) fail(`Sélecteur inconnu : @${kind || ''}`);
    r.i += 2;
    const args = r.s[r.i] === '[' ? selArgs(r.balanced().slice(1, -1)) : [];
    return this.select(kind, args);
  }
  select(kind, args) {
    const me = this.me();
    let list = kind === 's' ? [me] : kind === 'e' || kind === 'n' ? [...this.players(), ...this.mobs()] : this.players();
    let limit = kind === 'p' || kind === 'r' || kind === 'n' ? 1 : Infinity;
    let sort = kind === 'p' || kind === 'n' ? 'nearest' : kind === 'r' ? 'random' : 'arbitrary';
    const base = { x: me.pos.x, y: me.pos.y, z: me.pos.z };
    const box = {};
    let dist = null;
    const num = (v, k) => { const n = Number(v); if (!Number.isFinite(n) || v === '') fail(`Nombre attendu pour ${k} : ${v}`); return n; };
    const filters = [];
    const test = (not, f) => filters.push(not ? (e) => !f(e) : f);
    for (const { k, v, not } of args) {
      switch (k) {
        case 'x': case 'y': case 'z': base[k] = num(v, k); break;
        case 'dx': case 'dy': case 'dz': box[k[1]] = num(v, k); break;
        case 'distance': dist = range(v, k); if (dist[0] < 0) fail('distance ne peut pas être négative'); break;
        case 'limit': limit = num(v, k); if (limit < 1 || !Number.isInteger(limit)) fail('limit doit être un entier d\'au moins 1'); break;
        case 'sort': if (!['nearest', 'furthest', 'random', 'arbitrary'].includes(v)) fail(`sort inconnu : ${v}`); sort = v; break;
        case 'name': test(not, (e) => e.name === v); break;
        case 'type': {
          const t = unNs(v.toLowerCase());
          if (t[0] !== '#' && t !== 'player' && !SPECIES[t]) fail(`Type d'entité inconnu : ${v}`);
          test(not, (e) => (e.player ? t === 'player' : e.type === t));
          break;
        }
        case 'gamemode':
          if (!['survival', 'creative', 'adventure', 'spectator'].includes(v)) fail(`gamemode inconnu : ${v}`);
          test(not, (e) => e.mode === v);
          break;
        case 'level': { const [lo, hi] = range(v, k); test(not, () => lo <= 0 && hi >= 0); break; } // (pas d'expérience dans le jeu : niveau 0)
        case 'x_rotation': { const [lo, hi] = range(v, k); test(not, (e) => { const d = -e.pitch * 180 / Math.PI; return d >= lo && d <= hi; }); break; }
        case 'y_rotation': { const [lo, hi] = range(v, k); test(not, (e) => { const d = ((-e.yaw * 180 / Math.PI + 540) % 360) - 180; return d >= lo && d <= hi; }); break; }
        case 'tag': case 'team': test(not, () => v === ''); break; // (personne n'a d'étiquette ni d'équipe)
        case 'scores': {
          const cond = selArgs(v.replace(/^\{|\}$/g, '')).map((c) => [c.k, range(c.v, c.k)]);
          test(not, (e) => cond.every(([o, [lo, hi]]) => { const s = this.sb.entry(e.holder || e.name, o, false); return !!s && s.v >= lo && s.v <= hi; }));
          break;
        }
        default: fail(`Option de sélecteur non prise en charge : ${k}`);
      }
    }
    const dx = box.x, dy = box.y, dz = box.z, hasBox = dx !== undefined || dy !== undefined || dz !== undefined;
    const d2 = (e) => Math.hypot(e.pos.x - base.x, e.pos.y - base.y, e.pos.z - base.z);
    list = list.filter((e) => {
      if (dist) { const d = d2(e); if (d < dist[0] || d > dist[1]) return false; }
      if (hasBox) {
        const inAxis = (p, b, s) => (s >= 0 ? p >= b - 1 && p <= b + s + 1 : p >= b + s - 1 && p <= b + 1);
        if (!inAxis(e.pos.x, base.x, dx || 0) || !inAxis(e.pos.y, base.y, dy || 0) || !inAxis(e.pos.z, base.z, dz || 0)) return false;
      }
      return filters.every((f) => f(e));
    });
    if (sort === 'nearest') list.sort((a, b) => d2(a) - d2(b));
    else if (sort === 'furthest') list.sort((a, b) => d2(b) - d2(a));
    else if (sort === 'random') for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    return Number.isFinite(limit) ? list.slice(0, limit) : list;
  }

  // ---------- /say <message> ----------
  say(r) {
    if (!r.more) fail('Utilisation : /say <message>');
    const raw = r.rest();
    let out = '', i = 0;
    while (i < raw.length) {
      if (raw[i] === '@' && 'aeprsn'.includes(raw[i + 1] || ' ') && !/[A-Za-z0-9_]/.test(raw[i + 2] || ' ')) {
        const sr = new Reader(raw);
        sr.i = i;
        out += this.selector(sr).map((e) => e.name).join(', ');
        i = sr.i;
      } else out += raw[i++];
    }
    const { net, name, chat } = this.g, text = `[${name()}] ${out}`;
    if (net.isHost) net.broadcastJoined({ t: 'say', text });
    chat(text, 'chat');
  }

  // ---------- Texte ----------
  // Un texte : "entre guillemets", {"text":"..","color":"red"}, [..], ou un mot
  component(r) {
    r.ws();
    const c = r.s[r.i];
    let v;
    if (c === '{' || c === '[') v = parseSnbt(r.balanced());
    else if (c === '"' || c === '\'') {
      const a = r.i, q = c;
      r.i++;
      while (r.i < r.s.length && r.s[r.i] !== q) { if (r.s[r.i] === '\\') r.i++; r.i++; }
      if (r.i >= r.s.length) fail('Guillemet non fermé');
      r.i++;
      v = parseSnbt(r.s.slice(a, r.i));
    } else v = r.need('un texte');
    this.resolve(v); // (une erreur tout de suite, pas à l'affichage)
    return v;
  }
  resolve(v, st = {}) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return [{ t: String(v), ...st }];
    if (Array.isArray(v)) {
      if (!v.length) return [];
      const head = v[0], first = typeof head === 'object' && !Array.isArray(head) ? styleOf(head, st) : st;
      return [...this.resolve(head, st), ...v.slice(1).flatMap((x) => this.resolve(x, first))];
    }
    if (!v || typeof v !== 'object') return [];
    const s2 = styleOf(v, st);
    let txt = '';
    if (typeof v.text === 'string') txt = v.text;
    else if (typeof v.translate === 'string') txt = v.fallback || v.translate;
    else if (typeof v.keybind === 'string') txt = v.keybind;
    else if (typeof v.selector === 'string') {
      const sr = new Reader(v.selector);
      txt = this.selector(sr).map((e) => e.name).join(', ');
    } else if (v.score && typeof v.score === 'object') {
      const who = v.score.name === '*' ? this.me().name : String(v.score.name ?? '');
      const e = this.sb.entry(who, String(v.score.objective ?? ''), false);
      txt = e ? String(e.v) : '';
    }
    const out = [{ t: txt, ...s2 }];
    if (Array.isArray(v.extra)) out.push(...v.extra.flatMap((x) => this.resolve(x, s2)));
    return out;
  }
  title(o) { return o.auto ? this.resolve(o.raw) : o.title; }
  bracket(o) { return `[${plain(this.title(o))}]`; }
  // Un format de nombre : blank, fixed <texte>, styled <style>
  numberFormat(r) {
    const k = r.word().toLowerCase();
    if (k === 'blank') return { k };
    if (k === 'fixed') return { k, runs: this.resolve(this.component(r)) };
    if (k === 'styled') {
      r.ws();
      const c = r.s[r.i];
      const v = c === '{' ? parseSnbt(r.balanced()) : { color: r.need('un style') };
      return { k, st: styleOf(v) };
    }
    fail(`Format inconnu : ${k} (blank, fixed ou styled)`);
  }

  // ---------- /scoreboard ----------
  scoreboard(r) {
    const usage = 'Utilisation : /scoreboard objectives … ou /scoreboard players …';
    const sect = r.need(usage).toLowerCase();
    if (sect === 'objectives') this.sbObjectives(r);
    else if (sect === 'players') this.sbPlayers(r);
    else fail(usage);
  }
  objective(r, writable = false) {
    const n = r.need('le nom d\'un objectif'), o = this.sb.objectives.get(n);
    if (!o) fail(`Objectif inconnu : ${n}`);
    if (writable && READ_ONLY.has(o.criteria)) fail(`L'objectif ${n} est en lecture seule (son critère ${o.criteria} se met à jour tout seul)`);
    return o;
  }
  // Le critère, vérifié ; o.key : l'événement qui le fait monter (voir note)
  criterion(c) {
    if (SIMPLE_CRITERIA.includes(c)) return c === 'deathCount' || c === 'playerKillCount' || c === 'totalKillCount' ? c : null;
    if (/^(teamkill|killedByTeam)\.[a-z_]+$/.test(c)) { if (!COLORS[c.split('.')[1]]) fail(`Couleur inconnue dans le critère : ${c}`); return null; }
    const m = /^(?:hexacraft\.)?([a-z_]+):(?:hexacraft\.)?(.+)$/.exec(c);
    if (!m || !STAT_TYPES.includes(m[1])) fail(`Critère inconnu : ${c}`);
    const [, t, what] = m;
    if (t === 'custom') { if (!CUSTOM_STATS.includes(what)) fail(`Statistique inconnue : ${what}`); return `custom:${what}`; }
    if (t === 'killed' || t === 'killed_by') { if (what !== 'player' && !SPECIES[what]) fail(`Type d'entité inconnu : ${what}`); return `${t}:${what}`; }
    if (t === 'mined') { const id = blockId(what); if (id === null) fail(`Bloc inconnu : ${what}`); return `mined:${familyOf(id)}`; }
    const id = itemId(what);
    if (id === null) fail(`Objet inconnu : ${what}`);
    return `${t}:${familyOf(id)}`;
  }
  sbObjectives(r) {
    const { sb } = this, sub = r.need('list, add, remove, setdisplay ou modify').toLowerCase();
    if (sub === 'list') {
      r.end();
      if (!sb.objectives.size) { this.ok('Il n\'y a aucun objectif'); return; }
      this.ok(`${sb.objectives.size} objectif${sb.objectives.size > 1 ? 's' : ''} : ${[...sb.objectives.values()].map((o) => this.bracket(o)).join(', ')}`);
    } else if (sub === 'add') {
      const name = r.need('le nom de l\'objectif');
      if (!/^[0-9A-Za-z_.+-]+$/.test(name)) fail(`Nom d'objectif invalide : ${name} (lettres, chiffres, _ . + - seulement)`);
      if (sb.objectives.has(name)) fail(`Un objectif s'appelle déjà ${name}`);
      const criteria = r.need('le critère');
      const key = this.criterion(criteria);
      const raw = r.more ? this.component(r) : name;
      r.end();
      const o = { name, criteria, key, raw, title: this.resolve(raw), render: criteria === 'health' ? 'hearts' : 'integer', auto: false, fmt: null };
      sb.objectives.set(name, o);
      this.ok(`Objectif créé : ${this.bracket(o)}`);
    } else if (sub === 'remove') {
      const o = this.objective(r);
      r.end();
      const label = this.bracket(o);
      sb.remove(o.name);
      this.ok(`Objectif supprimé : ${label}`);
    } else if (sub === 'setdisplay') {
      let slot = r.need('un emplacement (list, sidebar, below_name, sidebar.team.<couleur>)');
      if (slot === 'belowName') slot = 'below_name';
      const m = /^sidebar\.team\.([a-z_]+)$/.exec(slot);
      if (slot !== 'list' && slot !== 'sidebar' && slot !== 'below_name' && !(m && COLORS[m[1]])) fail(`Emplacement inconnu : ${slot}`);
      if (r.more) {
        const o = this.objective(r);
        r.end();
        if (sb.slots[slot] === o.name) fail('Rien n\'a changé : cet emplacement montre déjà cet objectif');
        sb.slots[slot] = o.name;
        this.ok(`L'emplacement ${slot} montre maintenant ${this.bracket(o)}`);
      } else {
        if (!sb.slots[slot]) fail('Rien n\'a changé : cet emplacement est déjà vide');
        delete sb.slots[slot];
        this.ok(`L'emplacement ${slot} est maintenant vide`);
      }
    } else if (sub === 'modify') {
      const o = this.objective(r), what = r.need('displayname, rendertype, displayautoupdate ou numberformat').toLowerCase();
      if (what === 'displayname') {
        o.raw = this.component(r);
        o.title = this.resolve(o.raw);
        r.end();
        this.ok(`Le nom affiché de ${o.name} est maintenant ${this.bracket(o)}`);
      } else if (what === 'rendertype') {
        const v = r.need('hearts ou integer').toLowerCase();
        r.end();
        if (v !== 'hearts' && v !== 'integer') fail(`Type d'affichage inconnu : ${v}`);
        o.render = v;
        this.ok(`Affichage de ${this.bracket(o)} modifié : ${v}`);
      } else if (what === 'displayautoupdate') {
        const v = r.need('true ou false');
        r.end();
        o.auto = bool(v, 'displayautoupdate');
        this.ok(`Mise à jour automatique du nom de ${this.bracket(o)} : ${v}`);
      } else if (what === 'numberformat') {
        o.fmt = r.more ? this.numberFormat(r) : null;
        r.end();
        this.ok(o.fmt ? `Format des nombres de ${this.bracket(o)} modifié` : `Format des nombres de ${this.bracket(o)} remis à zéro`);
      } else fail(`Option inconnue : ${what}`);
    } else fail(`Sous-commande inconnue : ${sub}`);
  }
  // Une ou plusieurs entités : un sélecteur, un nom (même d'un joueur absent), ou * (tout le tableau)
  holders(r, star = true) {
    r.ws();
    if (r.s[r.i] === '@') {
      const l = this.selector(r);
      if (!l.length) fail('Aucune entité trouvée');
      return l.map((e) => e.holder || e.name);
    }
    const w = r.need('une entité (nom, sélecteur ou *)');
    if (w === '*') {
      if (!star) fail('* n\'est pas accepté ici');
      const l = [...this.sb.scores.keys()];
      if (!l.length) fail('Aucune entité suivie');
      return l;
    }
    if (w.length > 40) fail('Nom trop long (40 caractères au plus)');
    return [w];
  }
  sbPlayers(r) {
    const { sb } = this, sub = r.need('list, get, set, add, remove, reset, enable, operation ou display').toLowerCase();
    if (sub === 'list') {
      if (!r.more) {
        const l = [...sb.scores.keys()];
        this.ok(l.length ? `${l.length} entité${l.length > 1 ? 's' : ''} suivie${l.length > 1 ? 's' : ''} : ${l.join(', ')}` : 'Aucune entité suivie');
        return;
      }
      const h = this.holders(r, false);
      r.end();
      if (h.length > 1) fail('Une seule entité ici');
      const m = sb.scores.get(h[0]);
      if (!m?.size) { this.ok(`${h[0]} n'a aucun score`); return; }
      this.ok(`${h[0]} a ${m.size} score${m.size > 1 ? 's' : ''} :`);
      for (const [n, e] of m) { const o = sb.objectives.get(n); if (o) this.ok(`  ${this.bracket(o)} : ${e.v}`); }
    } else if (sub === 'get') {
      const h = this.holders(r, false), o = this.objective(r);
      r.end();
      if (h.length > 1) fail('Une seule entité ici');
      const e = sb.entry(h[0], o.name, false);
      if (!e) fail(`Impossible de lire ${o.name} pour ${h[0]} : aucun score`);
      this.ok(`${h[0]} a ${e.v} ${this.bracket(o)}`);
    } else if (sub === 'set' || sub === 'add' || sub === 'remove') {
      const h = this.holders(r), o = this.objective(r, true), n = sub === 'set' ? r.int('le score') : r.int('le nombre', 0);
      r.end();
      let last = 0;
      for (const x of h) {
        const e = sb.entry(x, o.name);
        e.v = sub === 'set' ? n : sub === 'add' ? (e.v + n) | 0 : (e.v - n) | 0;
        last = e.v;
      }
      const verb = { set: 'mis à', add: 'augmenté de', remove: 'diminué de' }[sub];
      this.ok(h.length === 1 ? `${this.bracket(o)} de ${h[0]} ${sub === 'set' ? `mis à ${n}` : `${verb} ${n} (maintenant ${last})`}` : `${this.bracket(o)} ${verb} ${n} pour ${h.length} entités`);
    } else if (sub === 'reset') {
      const h = this.holders(r), o = r.more ? this.objective(r) : null;
      r.end();
      for (const x of h) {
        const m = sb.scores.get(x);
        if (!m) continue;
        if (o) m.delete(o.name); else m.clear();
        if (!m.size) sb.scores.delete(x);
      }
      this.ok(`${o ? this.bracket(o) : 'Scores'} remis à zéro pour ${h.length === 1 ? h[0] : `${h.length} entités`}`);
    } else if (sub === 'enable') {
      const h = this.holders(r), o = this.objective(r);
      r.end();
      if (o.criteria !== 'trigger') fail(`${o.name} n'est pas un objectif trigger`);
      let n = 0;
      for (const x of h) { const e = sb.entry(x, o.name); if (e.locked) { e.locked = false; n++; } }
      if (!n) fail('Rien n\'a changé : ce déclencheur est déjà activé');
      this.ok(`Déclencheur ${this.bracket(o)} activé pour ${h.length === 1 ? h[0] : `${h.length} entités`}`);
    } else if (sub === 'operation') {
      const t = this.holders(r), to = this.objective(r, true), op = r.need('une opération');
      if (!OPS.includes(op)) fail(`Opération inconnue : ${op} (${OPS.join(' ')})`);
      const s = this.holders(r), so = this.objective(r);
      r.end();
      let last = 0;
      for (const x of t) {
        const a = sb.entry(x, to.name);
        for (const y of s) {
          const b = sb.entry(y, so.name);
          switch (op) {
            case '+=': a.v = (a.v + b.v) | 0; break;
            case '-=': a.v = (a.v - b.v) | 0; break;
            case '*=': a.v = Math.imul(a.v, b.v); break;
            case '/=': if (b.v) a.v = Math.floor(a.v / b.v) | 0; break;
            case '%=': if (b.v) a.v = ((a.v % b.v) + b.v) % b.v; break;
            case '=': a.v = b.v; break;
            case '<': a.v = Math.min(a.v, b.v); break;
            case '>': a.v = Math.max(a.v, b.v); break;
            default: { const k = a.v; a.v = b.v; b.v = k; }
          }
        }
        last = a.v;
      }
      this.ok(t.length === 1 ? `${this.bracket(to)} de ${t[0]} : ${last}` : `${this.bracket(to)} modifié pour ${t.length} entités`);
    } else if (sub === 'display') {
      const what = r.need('name ou numberformat').toLowerCase();
      const h = this.holders(r), o = this.objective(r);
      if (what === 'name') {
        const raw = r.more ? this.component(r) : null;
        r.end();
        for (const x of h) sb.entry(x, o.name).name = raw === null ? null : this.resolve(raw);
        this.ok(raw === null ? `Nom affiché de ${h.length === 1 ? h[0] : `${h.length} entités`} retiré dans ${this.bracket(o)}` : `Nom affiché modifié pour ${h.length === 1 ? h[0] : `${h.length} entités`} dans ${this.bracket(o)}`);
      } else if (what === 'numberformat') {
        const f = r.more ? this.numberFormat(r) : null;
        r.end();
        for (const x of h) sb.entry(x, o.name).fmt = f;
        this.ok(`Format du nombre modifié pour ${h.length === 1 ? h[0] : `${h.length} entités`} dans ${this.bracket(o)}`);
      } else fail(`Option inconnue : ${what}`);
    } else fail(`Sous-commande inconnue : ${sub}`);
  }

  // ---------- Ce qui fait monter les scores ----------
  // Un événement pour ce joueur : k = deathCount, playerKillCount, totalKillCount, custom:deaths,
  // mined:<famille>, used:<famille>, killed:<type>...
  bump(name, k, n = 1) {
    for (const o of this.sb.objectives.values()) {
      if (o.key !== k) continue;
      const e = this.sb.entry(name, o.name);
      e.v = (e.v + n) | 0;
    }
  }
  // Ce joueur vient de mourir (by : le nom de son tueur, s'il y en a un)
  died(name, by) {
    this.bump(name, 'deathCount');
    this.bump(name, 'custom:deaths');
    if (by && this.players().some((p) => p.name === by)) {
      this.bump(by, 'playerKillCount');
      this.bump(by, 'totalKillCount');
      this.bump(by, 'custom:player_kills');
      this.bump(by, 'killed:player');
      this.bump(name, 'killed_by:player');
    }
  }
  // Ce joueur vient de tuer un animal
  killed(name, type) {
    this.bump(name, 'totalKillCount');
    this.bump(name, 'custom:mob_kills');
    this.bump(name, `killed:${type}`);
  }
  // Le joueur local a miné / posé un bloc, est mort (chez un invité : l'hôte est prévenu)
  note(k, id) {
    const { net, name } = this.g;
    const key = `${k}:${familyOf(id)}`;
    if (net.isClient) { if (this.shown?.t) net.csend({ t: 'sbe', k: key }); return; }
    this.bump(name(), key);
  }
  localDeath(by) {
    const { net, name } = this.g;
    if (net.isClient) net.csend({ t: 'sbe', k: 'death', by });
    else this.died(name(), by);
  }
  // Un invité nous dit ce qui lui arrive (hôte)
  fromClient(c, m) {
    if (m.t === 'sbs') {
      const n = (v, hi) => (Number.isFinite(v) ? Math.max(0, Math.min(hi, v)) : hi);
      c.proxy.sb = { h: n(m.h, 1024), f: n(m.f, 1024), a: n(m.a, 1024), m: ['survival', 'creative', 'spectator'].includes(m.m) ? m.m : 'survival' };
    } else if (m.k === 'death') this.died(c.name, typeof m.by === 'string' ? m.by.slice(0, 40) : null);
    else if (typeof m.k === 'string' && /^(mined|used):/.test(m.k) && m.k.length < 40) this.bump(c.name, m.k);
  }

  // ---------- Chaque image ----------
  tick(dt) {
    const { net, survival } = this.g;
    if ((this.clock += dt) < 0.25) return;
    const step = this.clock;
    this.clock = 0;
    if (net.isClient) {
      this.sendT = (this.sendT || 0) + step;
      if (this.shown?.t && this.sendT >= 1) {
        this.sendT = 0;
        net.csend({ t: 'sbs', h: survival.health, f: survival.hunger, a: survival.air * 20, m: this.g.mode() });
      }
      return;
    }
    const { sb } = this;
    if (!sb.objectives.size && !this.lastView) return;
    // (les critères en lecture seule : ce que vaut le joueur en ce moment)
    for (const o of sb.objectives.values()) {
      if (!READ_ONLY.has(o.criteria)) continue;
      for (const p of this.players()) {
        const v = p.self ? { h: survival.on ? survival.health : 24, f: survival.on ? survival.hunger : 24, a: survival.air * 20 } : (net.clientNamed?.(p.name)?.proxy.sb || { h: 24, f: 24, a: 300 });
        sb.entry(p.name, o.name).v = o.criteria === 'health' ? Math.ceil(v.h) : o.criteria === 'food' ? Math.floor(v.f) : o.criteria === 'air' ? Math.round(v.a) : 0;
      }
    }
    const view = this.view(), js = JSON.stringify(view);
    if (js === this.lastView) return;
    this.lastView = js;
    this.applyView(view);
    if (net.isHost) net.broadcastJoined({ t: 'sbv', v: view });
  }
  // (un joueur vient d'arriver : il reçoit l'affichage)
  resend() { this.lastView = this.lastView ? '!' : ''; }

  // Le texte d'un score
  scoreRuns(o, e) {
    const f = e.fmt || o.fmt;
    if (f?.k === 'blank') return [];
    if (f?.k === 'fixed') return f.runs;
    return [{ t: o.render === 'hearts' ? `${(e.v / 2).toFixed(e.v % 2 ? 1 : 0)} ♥` : String(e.v), c: COLORS.red, ...(f?.k === 'styled' ? f.st : {}) }];
  }
  // Ce qui est à l'écran (envoyé tel quel aux invités)
  view() {
    const { sb } = this, slot = (s) => (sb.slots[s] ? sb.objectives.get(sb.slots[s]) : null);
    const side = slot('sidebar'), list = slot('list'), below = slot('below_name');
    const rows = (o) => sb.holdersOf(o.name).filter(([h]) => h[0] !== '#');
    const text = (o) => Object.fromEntries(rows(o).map(([h, e]) => [h, plain(this.scoreRuns(o, e))]));
    const track = [...sb.objectives.values()].some((o) => o.key || READ_ONLY.has(o.criteria));
    return {
      t: track ? 1 : 0,
      s: side ? { n: this.title(side), r: rows(side).sort((a, b) => b[1].v - a[1].v || (a[0] < b[0] ? -1 : 1)).slice(0, 15).map(([h, e]) => [e.name || [{ t: h }], this.scoreRuns(side, e)]) } : null,
      l: list ? { m: text(list) } : null,
      b: below ? { n: plain(this.title(below)), m: text(below) } : null,
    };
  }
  // Affiche (solo, hôte) ou applique ce que l'hôte a envoyé
  applyView(v) {
    this.shown = v && typeof v === 'object' ? v : null;
    this.drawSidebar();
    for (const rp of this.g.net.remotes.values()) rp.setBelow?.(this.belowOf(rp.name));
    this.g.viewChanged?.();
  }
  belowOf(name) {
    const b = this.shown?.b;
    if (!b || typeof b.m?.[name] !== 'string') return '';
    return `${b.m[name]} ${b.n}`.trim().slice(0, 60);
  }
  listScore(name) { const v = this.shown?.l?.m?.[name]; return typeof v === 'string' ? v : ''; }
  drawSidebar() {
    const s = this.shown?.s;
    if (!this.side) {
      this.side = document.getElementById('scoreboard');
      if (!this.side) return;
    }
    this.side.hidden = !s;
    if (!s) return;
    const fill = (el, runs) => {
      for (const r of Array.isArray(runs) ? runs.slice(0, 24) : []) {
        const sp = document.createElement('span');
        sp.textContent = String(r?.t ?? '').slice(0, 80);
        if (typeof r?.c === 'string' && /^#[0-9a-f]{6}$/i.test(r.c)) sp.style.color = r.c;
        if (r?.b) sp.style.fontWeight = '700';
        if (r?.i) sp.style.fontStyle = 'italic';
        const deco = [r?.u && 'underline', r?.s && 'line-through'].filter(Boolean).join(' ');
        if (deco) sp.style.textDecoration = deco;
        if (r?.o) sp.className = 'obf';
        el.appendChild(sp);
      }
    };
    this.side.innerHTML = '';
    const h = document.createElement('h4');
    fill(h, s.n);
    this.side.appendChild(h);
    for (const row of Array.isArray(s.r) ? s.r.slice(0, 15) : []) {
      const d = document.createElement('div'), a = document.createElement('span'), b = document.createElement('b');
      fill(a, row?.[0]);
      fill(b, row?.[1]);
      d.append(a, b);
      this.side.appendChild(d);
    }
  }

  // ---------- Compléter au clavier (Tab) ----------
  completions(text) {
    registry();
    const parts = text.replace(/^\//, '').split(' '), last = parts[parts.length - 1], cmd = parts[0].toLowerCase(), n = parts.length;
    if (n === 1) return ['setblock', 'fill', 'say', 'scoreboard'].filter((c) => c.startsWith(last.toLowerCase()));
    const blocks = () => [...shownBlocks];
    const names = () => ['@a', '@p', '@r', '@s', '@e', '@n', ...this.players().map((p) => p.name)];
    const objs = () => [...this.sb.objectives.keys()];
    const crits = () => [...SIMPLE_CRITERIA, ...CUSTOM_STATS.map((s) => `custom:${s}`)];
    let c = [];
    if (cmd === 'setblock') c = n <= 4 ? ['~'] : n === 5 ? blocks() : n === 6 ? ['destroy', 'keep', 'replace', 'strict'] : [];
    else if (cmd === 'fill') c = n <= 7 ? ['~'] : n === 8 ? blocks() : n === 9 ? ['destroy', 'hollow', 'keep', 'outline', 'replace', 'strict'] : n === 10 && parts[8] === 'replace' ? blocks() : [];
    else if (cmd === 'say') c = names();
    else if (cmd === 'scoreboard') {
      const [, a, b] = parts;
      if (n === 2) c = ['objectives', 'players'];
      else if (a === 'objectives') {
        if (n === 3) c = ['list', 'add', 'remove', 'setdisplay', 'modify'];
        else if (b === 'add') c = n === 5 ? crits() : [];
        else if (b === 'remove') c = n === 4 ? objs() : [];
        else if (b === 'setdisplay') c = n === 4 ? ['list', 'sidebar', 'below_name', ...Object.keys(COLORS).map((k) => `sidebar.team.${k}`)] : n === 5 ? objs() : [];
        else if (b === 'modify') c = n === 4 ? objs() : n === 5 ? ['displayname', 'rendertype', 'displayautoupdate', 'numberformat'] : n === 6 ? ({ rendertype: ['hearts', 'integer'], displayautoupdate: ['true', 'false'], numberformat: ['blank', 'fixed', 'styled'] }[parts[4]] || []) : [];
      } else if (a === 'players') {
        if (n === 3) c = ['list', 'get', 'set', 'add', 'remove', 'reset', 'enable', 'operation', 'display'];
        else if (b === 'display') c = n === 4 ? ['name', 'numberformat'] : n === 5 ? ['*', ...names()] : n === 6 ? objs() : [];
        else if (n === 4) c = ['*', ...names()];
        else if (n === 5 && b !== 'list') c = objs();
        else if (b === 'operation') c = n === 6 ? OPS : n === 7 ? ['*', ...names()] : n === 8 ? objs() : [];
      }
    }
    const low = last.toLowerCase();
    return c.filter((v) => v.toLowerCase().startsWith(low)).slice(0, 40);
  }
}
export const COMMAND_RE = /^\/(setblock|fill|say|scoreboard)(\s|$)/i;
