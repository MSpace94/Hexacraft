// Carte du monde vue du dessus (façon Chunkbase) : biomes, relief ombré, position du
// joueur et point d'apparition, pour n'importe quelle graine. Les tuiles sont
// dessinées par des threads (mapworker.js) et gardées en cache.
import { Generator, BIOME, BIOME_NAMES, BIOME_COLORS, randomSeed, GEN_LATEST, GEN_CONTENT, RAISED, WORLD_HEIGHT } from './gen.js?v=1.1.5-alpha-mvm2b95g';
import { hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { t } from './i18n.js?v=1.1.5-alpha-mvm2b95g';

const TILE = 128;                                     // pixels par tuile
const SCALES = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];   // blocs par pixel
const MAX_TILES = 900;
// Calque de la météo : un point de climat pour RAIN_STEP pixels de côté (lissé à
// l'affichage), calculé par rangées (RAIN_BUDGET ms par image) et refait seulement si la vue
// change ou toutes les RAIN_REFRESH secondes (le temps avance)
const RAIN_STEP = 5, RAIN_BUDGET = 5, RAIN_REFRESH = 3;
const RAIN_KEY = 'hexacraft.mapRain';
const OBJECTS_KEY = 'hexacraft.mapObjects';
const HEX_R = 1 / Math.sqrt(3); // rayon d'une case (blocs)
// petite pluie (vert) -> pluie (jaune) -> forte pluie (rouge) ; orage, neige
const RAIN_COLORS = [[60, 200, 80], [240, 220, 50], [230, 60, 40]];
const STORM_COLOR = [210, 60, 220], SNOW_COLOR = [100, 220, 255];
const rainColor = (r) => {
  const t = Math.min(1.999, r * 2), i = Math.floor(t), f = t - i, a = RAIN_COLORS[i], b = RAIN_COLORS[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
};

// Couleurs des repères (choisie d'après le joueur qui le pose)
export const MARK_COLORS = ['#ff5a5a', '#ffb43c', '#ffe14a', '#6fe36f', '#4ad8ff', '#5a8cff', '#c88cff', '#ff8fd0'];

// Couleur d'un joueur sur la carte (toujours la même pour un même pseudo)
function playerColor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360}, 80%, 60%)`;
}

export class WorldMap {
  constructor() {
    this.canvas = document.getElementById('map-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.info = document.getElementById('map-info');
    this.seedInput = document.getElementById('map-seed');
    this.tiles = new Map();    // clé -> canvas de la tuile
    this.pending = new Set();  // tuiles demandées aux threads
    this.queue = [];
    this.workers = [];
    this.busy = [];
    this.cx = 0; this.cz = 0; this.zoom = 4;
    this.world = null;         // { gtype, seed, version }
    this.player = null;        // () => { x, z, yaw } quand on regarde son propre monde
    this.others = null;        // () => [{ name, x, z, yaw }] : les autres joueurs (en ligne)
    this.marks = null;         // repères du monde : { list(), add(x, z, nom), remove(id) }
    this.objects = null;       // () => objets physiques [{ x, z, cells() -> [[x, z], ...] }]
    this.objectsOn = true;     // les afficher (case à cocher, retenue)
    try { this.objectsOn = localStorage.getItem(OBJECTS_KEY) !== '0'; } catch { /* stockage indisponible */ }
    // Brouillard (survie) : { cells: Set des cases explorées "cx,cz", size : blocs par case } ou
    // null (créatif, ou la carte d'une graine : tout est visible)
    this.fog = null;
    this.fogMask = null;     // { canvas, x0, z0, n } : les cases explorées, 1 pixel par case
    this.spawn = null;
    this.mouse = null;
    this.dirty = true;
    this.open_ = false;
    this.weather = null;       // { climate, time } quand on regarde son propre monde
    this.rainOn = false;
    try { this.rainOn = localStorage.getItem(RAIN_KEY) === '1'; } catch { /* stockage indisponible */ }
    this.rain = null;          // calque prêt : { canvas, x0, z0, s, cols, rows }
    this.rainJob = null;       // calque en cours de calcul (ou le dernier fini)
    this.rainAge = 0;
    this.buildLegend();
    this.bindInput();
  }

  buildLegend() {
    const el = document.getElementById('map-legend');
    el.innerHTML = BIOME_NAMES.map((n, i) =>
      `<span><i style="background:rgb(${BIOME_COLORS[i].join(',')})"></i>${n}</span>`).join('');
  }

  startWorkers() {
    if (this.workers.length) return;
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./mapworker.js?v=1.1.5-alpha-mvm2b95g', import.meta.url), { type: 'module' });
      w.onmessage = (e) => this.onResult(i, e.data);
      this.workers.push(w);
      this.busy.push(false);
    }
  }

  // Ouvre la carte. world : { gtype, seed, version }, player : fonction de position ou null.
  open(world, player = null, weather = null, others = null, marks = null, objects = null) {
    this.startWorkers();
    this.player = player;
    this.objects = objects;
    this.others = others;
    this.marks = marks;
    this.closeMark();
    this.weather = weather;
    this.rain = this.rainJob = null;
    this.homeWorld = player ? world : null;
    this.homeSeed = player ? world.seed : null;
    this.worldKey = null; // on repart toujours de ce monde (sa graine a pu changer)
    this.setWorld(world);
    const p = player && player();
    if (p) { this.cx = p.x; this.cz = p.z; }
    this.open_ = true;
    this.resize();
    this.loop();
  }

  close() {
    this.open_ = false;
    this.closeMark();
  }

  // ---------- Repères ----------
  // Repère sous le point (sx, sy) de l'écran, ou null
  markAt(sx, sy) {
    if (!this.marks || !this.viewingHome()) return null;
    let best = null, bd = 12;
    for (const m of this.marks.list()) {
      const p = this.toScreen(m.x, m.z), d = Math.hypot(p.sx - sx, p.sy - 8 - sy);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  // Petite fenêtre près du point (sx, sy) : nouveau repère en (x, z), ou repère existant m
  openMark(sx, sy, x, z, m = null) {
    const box = document.getElementById('map-mark'), wrap = box.parentElement;
    this.markEdit = { x, z, m };
    box.hidden = false;
    box.style.left = Math.max(4, Math.min(wrap.clientWidth - 258, sx + 12)) + 'px';
    box.style.top = Math.max(4, Math.min(wrap.clientHeight - 130, sy + 12)) + 'px';
    const name = document.getElementById('map-mark-name');
    document.getElementById('map-mark-title').textContent = m
      ? `« ${m.n} » (X ${Math.round(m.x)}, Z ${Math.round(m.z)})${m.by ? ' — posé par ' + m.by : ''}`
      : `Nouveau repère en X ${Math.round(x)}, Z ${Math.round(z)}`;
    name.hidden = !!m;
    document.getElementById('map-mark-ok').hidden = !!m;
    document.getElementById('map-mark-del').hidden = !m;
    if (!m) { name.value = ''; setTimeout(() => name.focus(), 0); }
  }

  closeMark() {
    const box = document.getElementById('map-mark');
    if (box) box.hidden = true;
    this.markEdit = null;
  }

  drawMarks(ctx) {
    if (!this.marks || !this.viewingHome()) return;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const m of this.marks.list()) {
      const p = this.toScreen(m.x, m.z);
      // épingle : pointe sur l'endroit, tête ronde de la couleur du repère
      ctx.fillStyle = MARK_COLORS[m.c % MARK_COLORS.length];
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.sx, p.sy);
      ctx.lineTo(p.sx - 5, p.sy - 10);
      ctx.arc(p.sx, p.sy - 12, 6, Math.PI * 0.8, Math.PI * 2.2);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      const w = ctx.measureText(m.n).width + 8;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(p.sx - w / 2, p.sy - 36, w, 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(m.n, p.sx, p.sy - 24);
    }
    ctx.textAlign = 'start';
  }

  setWorld(world) {
    const key = world.gtype + '|' + world.seed + '|' + world.version;
    if (key !== this.worldKey) {
      this.worldKey = key;
      this.world = world;
      this.gen = new Generator(world.gtype, world.seed, WORLD_HEIGHT, world.version);
      // son propre monde : les endroits déjà visités avant le monde surélevé (au fond d'une cuvette)
      this.oldList = [];
      if (world.chunkVer) {
        const cv = world.chunkVer;
        this.gen.versionAt = (q, r) => cv.get(Math.floor(q / 16) + ',' + Math.floor(r / 16)) ?? GEN_CONTENT;
        this.gen.setOldChunks(cv);
        for (const [k, v] of cv) if (v < RAISED) this.oldList.push(k);
      }
      this.oldSent = [];
      this.tiles.clear();
      this.pending.clear();
      this.queue = [];
      this.spawn = null;
      this.cx = 0; this.cz = 0;
      this.requestSpawn();
    }
    this.seedInput.value = world.seed;
    this.dirty = true;
  }

  requestSpawn() {
    this.spawnWanted = true;
    this.pump();
  }

  // Index d'un thread libre (ou -1)
  idle(start) {
    for (let i = start; i < this.workers.length; i++) if (!this.busy[i]) return i;
    return -1;
  }

  onResult(i, m) {
    this.busy[i] = false;
    if (m.key.startsWith(this.worldKey + '#')) {
      if (m.type === 'spawn') {
        const p = hexToWorld(m.spawn.q, m.spawn.r);
        this.spawn = { x: p.x, z: p.z };
        if (!this.viewingHome()) { this.cx = p.x; this.cz = p.z; }
      } else {
        const c = document.createElement('canvas');
        c.width = c.height = TILE;
        c.getContext('2d').putImageData(new ImageData(m.px, TILE, TILE), 0, 0);
        if (this.tiles.size > MAX_TILES) this.tiles.delete(this.tiles.keys().next().value);
        this.tiles.set(m.key, c);
      }
      this.dirty = true;
    }
    this.pending.delete(m.key);
    this.pump();
  }

  // Envoie les tuiles les plus proches du centre de l'écran aux threads libres.
  pump() {
    let i;
    while ((i = this.idle(0)) >= 0) {
      const { gtype, seed, version } = this.world;
      if (this.spawnWanted) {
        this.spawnWanted = false;
        this.busy[i] = true;
        this.workers[i].postMessage({ type: 'spawn', key: this.worldKey + '#spawn', gtype, seed, version, old: this.oldFor(i) });
        continue;
      }
      const job = this.queue.shift();
      if (!job) return;
      if (this.tiles.has(job.key) || this.pending.has(job.key)) continue;
      this.pending.add(job.key);
      this.busy[i] = true;
      this.workers[i].postMessage({ type: 'tile', key: job.key, gtype, seed, version, old: this.oldFor(i), tx: job.tx, tz: job.tz, scale: SCALES[job.z] });
    }
  }

  // Liste des endroits déjà visités, envoyée une seule fois à chaque thread (sinon : undefined)
  oldFor(i) {
    if (this.oldSent[i] === this.worldKey) return undefined;
    this.oldSent[i] = this.worldKey;
    return this.oldList;
  }

  tileKey(z, tx, tz) {
    return `${this.worldKey}#${z}|${tx}|${tz}`;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.dirty = true;
    }
  }

  loop() {
    if (!this.open_) return;
    this.resize();
    if (this.player) this.dirty = true; // la flèche du joueur bouge (partie en ligne)
    this.updateRain();
    if (this.dirty) { this.dirty = false; this.draw(); }
    requestAnimationFrame(() => this.loop());
  }

  // pixel de l'écran -> point du monde
  toWorld(sx, sy) {
    const s = SCALES[this.zoom];
    return { x: this.cx + (sx - this.canvas.width / 2) * s, z: this.cz + (sy - this.canvas.height / 2) * s };
  }
  toScreen(x, z) {
    const s = SCALES[this.zoom];
    return { sx: (x - this.cx) / s + this.canvas.width / 2, sy: (z - this.cz) / s + this.canvas.height / 2 };
  }

  draw() {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    const z = this.zoom, s = SCALES[z], span = TILE * s;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#10204a';
    ctx.fillRect(0, 0, W, H);

    const a = this.toWorld(0, 0), b = this.toWorld(W, H);
    const tx0 = Math.floor(a.x / span), tx1 = Math.floor(b.x / span);
    const tz0 = Math.floor(a.z / span), tz1 = Math.floor(b.z / span);
    const want = [];
    for (let tz = tz0; tz <= tz1; tz++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const { sx, sy } = this.toScreen(tx * span, tz * span);
        const X = Math.floor(sx), Y = Math.floor(sy), S = Math.floor(sx + TILE) - X;
        const key = this.tileKey(z, tx, tz);
        const t = this.tiles.get(key);
        if (t) { ctx.drawImage(t, X, Y, S, S); continue; }
        // en attendant : une tuile moins détaillée déjà prête, agrandie
        for (let k = 1; k <= 4 && z + k < SCALES.length; k++) {
          const p = this.tiles.get(this.tileKey(z + k, tx >> k, tz >> k));
          if (!p) continue;
          const sub = TILE >> k;
          ctx.drawImage(p, (tx - ((tx >> k) << k)) * sub, (tz - ((tz >> k) << k)) * sub, sub, sub, X, Y, S, S);
          break;
        }
        if (!this.pending.has(key)) {
          const dx = tx + 0.5 - (this.cx / span), dz = tz + 0.5 - (this.cz / span);
          want.push({ key, tx, tz, z, d: dx * dx + dz * dz });
        }
      }
    }
    want.sort((p, q) => p.d - q.d);
    this.queue = want;
    this.pump();

    this.drawRain();
    this.drawFog(W, H, s);
    this.drawOverlay(W, H, s);
  }

  // Le brouillard : tout est caché sauf les cases explorées (bords adoucis)
  drawFog(W, H, s) {
    const F = this.fog;
    if (!F) return;
    const M = this.fogMask;
    if (!M || M.n !== F.cells.size || M.ref !== F.cells) this.buildFogMask();
    const m = this.fogMask;
    const f = (this.fogLayer ||= document.createElement('canvas'));
    if (f.width !== W || f.height !== H) { f.width = W; f.height = H; }
    const c = f.getContext('2d');
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#1b1d24';
    c.fillRect(0, 0, W, H);
    if (m) {
      c.globalCompositeOperation = 'destination-out';
      c.imageSmoothingEnabled = true;
      const p = this.toScreen(m.x0 * F.size, m.z0 * F.size), k = F.size / s;
      c.drawImage(m.canvas, p.sx, p.sy, m.canvas.width * k, m.canvas.height * k);
    }
    this.ctx.drawImage(f, 0, 0);
  }
  buildFogMask() {
    const F = this.fog;
    if (!F.cells.size) { this.fogMask = null; return; }
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    const list = [];
    for (const k of F.cells) {
      const i = k.indexOf(','), x = +k.slice(0, i), z = +k.slice(i + 1);
      list.push(x, z);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    x0 -= 1; z0 -= 1;
    const c = document.createElement('canvas');
    c.width = x1 - x0 + 2; c.height = z1 - z0 + 2;
    const ctx = c.getContext('2d'), img = ctx.createImageData(c.width, c.height);
    for (let i = 0; i < list.length; i += 2) img.data[((list[i + 1] - z0) * c.width + (list[i] - x0)) * 4 + 3] = 255;
    ctx.putImageData(img, 0, 0);
    this.fogMask = { canvas: c, x0, z0, n: F.cells.size, ref: F.cells };
  }

  // Le calque de la météo est-il affiché ? (seulement sur le monde où l'on joue)
  showsRain() {
    return this.rainOn && !!this.weather && this.viewingHome();
  }

  // Calque de la météo : recalculé quand la vue a changé (ou le temps a avancé), par rangées
  updateRain() {
    const box = document.getElementById('map-rain-box');
    box.hidden = !(this.weather && this.viewingHome());
    box.classList.toggle('on', this.rainOn);
    if (!this.showsRain()) { this.rain = this.rainJob = null; return; }
    const W = this.canvas.width, H = this.canvas.height, bs = SCALES[this.zoom] * RAIN_STEP;
    const cols = Math.ceil(W / RAIN_STEP) + 2, rows = Math.ceil(H / RAIN_STEP) + 2;
    // grille calée sur le monde (pas de tremblement quand on fait glisser la carte)
    const a = this.toWorld(0, 0);
    const x0 = Math.floor(a.x / bs) * bs, z0 = Math.floor(a.z / bs) * bs;
    const key = cols + '|' + rows + '|' + x0 + '|' + z0 + '|' + bs;
    const now = performance.now();
    let job = this.rainJob;
    // nouveau calcul : la vue a changé, ou le dernier est trop vieux (et le temps a avancé)
    if (!job || (job.key !== key && job.done) || (job.done && now - this.rainAge > RAIN_REFRESH * 1000)) {
      const T = this.weather.time();
      if (job && job.key === key && Math.abs(T - job.T) < 1e-4) { this.rainAge = now; return; }
      const c = document.createElement('canvas');
      c.width = cols; c.height = rows;
      job = this.rainJob = { key, T, cols, rows, x0, z0, s: bs, row: 0, done: false, canvas: c, img: new ImageData(cols, rows) };
    } else if (job.key !== key && !job.done) {
      // la vue a changé pendant le calcul : on repart tout de suite sur la nouvelle
      job = this.rainJob = { ...job, key, cols, rows, x0, z0, s: bs, row: 0, canvas: Object.assign(document.createElement('canvas'), { width: cols, height: rows }), img: new ImageData(cols, rows) };
    }
    if (job.done) return;
    const end = now + RAIN_BUDGET, d = job.img.data, cl = this.weather.climate, g = this.gen, f = {};
    while (job.row < job.rows) {
      const y = job.row++, z = job.z0 + (y + 0.5) * job.s;
      for (let x = 0; x < job.cols; x++) {
        const wx = job.x0 + (x + 0.5) * job.s, o = (y * job.cols + x) * 4;
        cl.at(wx, z, job.T, 0, f);
        if (f.rain < 0.02 && f.storm < 0.02) continue;
        // de la pluie ici : désert (plus sec) ou froid (neige) ? (le sol n'est lu qu'ici)
        const h = worldToHex(wx, z);
        if (g.v3 && g.biomeAt(h.q, h.r) === BIOME.DESERT) {
          cl.at(wx, z, job.T, 1, f);
          if (f.rain < 0.02 && f.storm < 0.02) continue;
        }
        // couleurs d'un radar météo (lisibles sur l'océan comme sur la neige)
        const c = g.isCold(h.q, h.r) ? SNOW_COLOR : f.storm > 0.3 ? STORM_COLOR : rainColor(f.rain);
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2];
        d[o + 3] = 120 + 110 * Math.max(f.rain, f.storm);
      }
      if (performance.now() > end) break;
    }
    if (job.row >= job.rows) {
      job.done = true;
      job.canvas.getContext('2d').putImageData(job.img, 0, 0);
      this.rain = job;
      this.rainAge = now;
      this.dirty = true;
    }
  }

  drawRain() {
    const r = this.rain;
    if (!r || !this.showsRain()) return;
    const p = this.toScreen(r.x0, r.z0), k = r.s / SCALES[this.zoom];
    const ctx = this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = true; // bords doux
    ctx.drawImage(r.canvas, p.sx, p.sy, r.cols * k, r.rows * k);
    // tornades en cours : un entonnoir gris
    const W = this.canvas.width, H = this.canvas.height, c = this.toWorld(W / 2, H / 2);
    const R = Math.min(20000, Math.hypot(W, H) * 0.5 * SCALES[this.zoom]);
    for (const t of this.weather.climate.tornadoesNear(c.x, c.z, this.weather.time(), R)) {
      const s = this.toScreen(t.x, t.z);
      ctx.fillStyle = '#d8d4cc';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.sx - 9, s.sy - 10); ctx.lineTo(s.sx + 9, s.sy - 10); ctx.lineTo(s.sx + 1.5, s.sy + 10); ctx.lineTo(s.sx - 1.5, s.sy + 10);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.beginPath();
      for (const y of [-5, 0, 5]) { const w = 7 - (y + 5) * 0.5; ctx.moveTo(s.sx - w, s.sy + y); ctx.lineTo(s.sx + w, s.sy + y); }
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawOverlay(W, H, s) {
    const ctx = this.ctx;
    // axes passant par l'origine du monde
    const o = this.toScreen(0, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(o.sx) + 0.5, 0); ctx.lineTo(Math.round(o.sx) + 0.5, H);
    ctx.moveTo(0, Math.round(o.sy) + 0.5); ctx.lineTo(W, Math.round(o.sy) + 0.5);
    ctx.stroke();

    // point d'apparition
    if (this.spawn) {
      const p = this.toScreen(this.spawn.x, this.spawn.z);
      ctx.fillStyle = '#ffe14a';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 4 : 10, ang = -Math.PI / 2 + (i * Math.PI) / 5;
        ctx.lineTo(p.sx + Math.cos(ang) * r, p.sy + Math.sin(ang) * r);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }

    // joueur : flèche dans la direction du regard ; les autres joueurs (en ligne) : une flèche
    // de couleur avec leur nom
    const arrow = (x, z, yaw, color, size) => {
      const p = this.toScreen(x, z);
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      ctx.save();
      ctx.translate(p.sx, p.sy);
      ctx.rotate(Math.atan2(fz, fx) + Math.PI / 2);
      ctx.scale(size, size);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2 / size;
      ctx.beginPath();
      ctx.moveTo(0, -11); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
      return p;
    };
    if (this.viewingHome() && this.others) {
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const o of this.others()) {
        const p = arrow(o.x, o.z, o.yaw, playerColor(o.name), 0.85);
        const w = ctx.measureText(o.name).width + 8;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(p.sx - w / 2, p.sy - 28, w, 16);
        ctx.fillStyle = '#fff';
        ctx.fillText(o.name, p.sx, p.sy - 16);
      }
      ctx.textAlign = 'start';
    }
    if (this.rails && this.viewingHome()) this.drawRails(ctx, s);
    if (this.objectsOn && this.objects && this.viewingHome()) this.drawObjects(ctx, s);
    this.drawMarks(ctx);
    const me = this.viewingHome() ? this.player() : null;
    if (me) arrow(me.x, me.z, me.yaw, '#ffffff', 1);

    // échelle
    const target = 120 * s;
    const pow = 10 ** Math.floor(Math.log10(target));
    const len = [5, 2, 1].map((m) => m * pow).find((v) => v <= target) || pow;
    const px = len / s;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(10, H - 34, px + 20, 24);
    ctx.fillStyle = '#fff';
    ctx.fillRect(20, H - 16, px, 3);
    ctx.font = '600 12px Segoe UI, sans-serif';
    ctx.fillText(len >= 1000 ? `${len / 1000} km` : t('{0} blocs', len), 20, H - 21);

    this.updateInfo();
  }

  // Réseau ferré (voir mapRails dans main.js) : les voies, les gares (avec leur nom, de près) et
  // les trains (la locomotive en jaune, les wagons en gris), en direct
  drawRails(ctx, s) {
    const R = this.rails();
    const W = this.canvas.width, H = this.canvas.height, w = Math.max(2, Math.min(6, 3 / s));
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const [col, lw] of [['rgba(0,0,0,0.65)', w + 2], ['#d9dde3', w]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (const l of R.lines) {
        const a = this.toScreen(l[0], l[1]), b = this.toScreen(l[l.length - 2], l[l.length - 1]);
        if (Math.max(a.sx, b.sx) < -50 && l.length < 6) continue;
        for (let i = 0; i < l.length; i += 2) { const p = this.toScreen(l[i], l[i + 1]); if (i) ctx.lineTo(p.sx, p.sy); else ctx.moveTo(p.sx, p.sy); }
      }
      ctx.stroke();
    }
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const st of R.stations) {
      const p = this.toScreen(st.x, st.z);
      if (p.sx < -100 || p.sy < -100 || p.sx > W + 100 || p.sy > H + 100) continue;
      ctx.fillStyle = '#e0ab2a';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.fillRect(p.sx - 5, p.sy - 5, 10, 10);
      ctx.strokeRect(p.sx - 5, p.sy - 5, 10, 10);
      if (s < 2.5 && st.name) {
        const tw = ctx.measureText(st.name).width + 8;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(p.sx - tw / 2, p.sy - 24, tw, 15);
        ctx.fillStyle = '#ffd34d';
        ctx.fillText(st.name, p.sx, p.sy - 12);
      }
    }
    ctx.textAlign = 'start';
    const half = Math.max(3, 5.1 / s);
    for (const c of R.cars) {
      const p = this.toScreen(c.x, c.z);
      if (p.sx < -50 || p.sy < -50 || p.sx > W + 50 || p.sy > H + 50) continue;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = w + 5;
      ctx.beginPath();
      ctx.moveTo(p.sx - c.dx * half, p.sy - c.dz * half);
      ctx.lineTo(p.sx + c.dx * half, p.sy + c.dz * half);
      ctx.stroke();
      ctx.strokeStyle = c.loco ? '#ffcf3a' : '#9aa3ad';
      ctx.lineWidth = w + 3;
      ctx.stroke();
    }
  }

  // Objets physiques (collés) : vus du dessus, case par case ; de loin (cases trop petites), un
  // simple losange à leur place
  drawObjects(ctx, s) {
    const r = HEX_R / s; // rayon d'une case à l'écran (pixels)
    const W = this.canvas.width, H = this.canvas.height;
    ctx.lineWidth = 1;
    for (const o of this.objects()) {
      const c = this.toScreen(o.x, o.z);
      if (c.sx < -200 || c.sy < -200 || c.sx > W + 200 || c.sy > H + 200) continue;
      if (r < 1.1) {
        ctx.fillStyle = '#ff9a3c';
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(c.sx, c.sy - 6); ctx.lineTo(c.sx + 5, c.sy); ctx.lineTo(c.sx, c.sy + 6); ctx.lineTo(c.sx - 5, c.sy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = 'rgba(255, 154, 60, 0.85)';
      ctx.strokeStyle = 'rgba(60, 30, 0, 0.9)';
      ctx.beginPath();
      for (const [x, z] of o.cells()) {
        const p = this.toScreen(x, z);
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 6 + (i * Math.PI) / 3; // (hexagone pointe en haut)
          if (i) ctx.lineTo(p.sx + Math.cos(a) * r, p.sy + Math.sin(a) * r); else ctx.moveTo(p.sx + Math.cos(a) * r, p.sy + Math.sin(a) * r);
        }
        ctx.closePath();
      }
      ctx.fill();
      if (r >= 2) ctx.stroke();
    }
  }

  updateInfo() {
    if (!this.mouse) { this.info.textContent = 'Glisser : se déplacer — Molette : zoom' + (this.marks && this.viewingHome() ? ' — Clic droit : poser un repère' : ''); return; }
    const { x, z } = this.toWorld(this.mouse.x, this.mouse.y);
    const { q, r } = worldToHex(x, z);
    let text = `X ${Math.round(x)}  Z ${Math.round(z)}   (hexa q ${q}, r ${r})`;
    if (this.gen.v3) {
      const c = this.gen.columnAt(x, z);
      text += `   —   ${BIOME_NAMES[c.biome]}, altitude ${c.h}`;
    } else {
      text += `   —   altitude ${this.gen.height(q, r)}`;
    }
    this.info.textContent = text;
  }

  zoomAt(dir, sx = this.canvas.width / 2, sy = this.canvas.height / 2) {
    const z = Math.max(0, Math.min(SCALES.length - 1, this.zoom + dir));
    if (z === this.zoom) return;
    const before = this.toWorld(sx, sy);
    this.zoom = z;
    const after = this.toWorld(sx, sy);
    this.cx += before.x - after.x;
    this.cz += before.z - after.z;
    this.dirty = true;
  }

  centerOn(p) {
    if (!p) return;
    this.cx = p.x;
    this.cz = p.z;
    this.dirty = true;
  }

  bindInput() {
    const c = this.canvas;
    let drag = null;
    c.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, cx: this.cx, cz: this.cz, moved: false };
      c.setPointerCapture(e.pointerId);
    });
    // clic droit : poser un repère (dans son propre monde) ; clic sur un repère : le voir / retirer
    c.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.marks || !this.viewingHome()) return;
      const r = c.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      const m = this.markAt(sx, sy);
      const w = this.toWorld(sx, sy);
      this.openMark(sx, sy, w.x, w.z, m);
    });
    const name = document.getElementById('map-mark-name');
    const add = () => {
      const e = this.markEdit, n = name.value.trim().slice(0, 24);
      if (!e || e.m || !n) return;
      this.marks.add(e.x, e.z, n);
      this.closeMark();
      this.dirty = true;
    };
    document.getElementById('map-mark-ok').addEventListener('click', add);
    document.getElementById('map-mark-del').addEventListener('click', () => {
      if (this.markEdit?.m) this.marks.remove(this.markEdit.m.id);
      this.closeMark();
      this.dirty = true;
    });
    document.getElementById('map-mark-x').addEventListener('click', () => this.closeMark());
    name.addEventListener('keydown', (e) => {
      e.stopPropagation(); // (Échap ne quitte pas la carte, les touches ne vont pas au jeu)
      if (e.key === 'Enter') add();
      if (e.key === 'Escape') this.closeMark();
    });
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (drag) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) drag.moved = true;
        const s = SCALES[this.zoom];
        this.cx = drag.cx - (e.clientX - drag.x) * s;
        this.cz = drag.cz - (e.clientY - drag.y) * s;
      }
      this.dirty = true;
    });
    c.addEventListener('pointerup', (e) => {
      // simple clic sur un repère : sa fenêtre (le voir, le retirer)
      if (drag && !drag.moved) {
        const r = c.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
        const m = this.markAt(sx, sy);
        if (m) this.openMark(sx, sy, m.x, m.z, m); else this.closeMark();
      }
      drag = null;
    });
    c.addEventListener('pointerleave', () => { this.mouse = null; this.dirty = true; });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      this.zoomAt(e.deltaY > 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    document.getElementById('map-in').addEventListener('click', () => this.zoomAt(-1));
    document.getElementById('map-out').addEventListener('click', () => this.zoomAt(1));
    document.getElementById('map-spawn').addEventListener('click', () => this.centerOn(this.spawn));
    document.getElementById('map-me').addEventListener('click', () => {
      if (!this.player) return;
      if (!this.viewingHome()) this.showSeed(this.homeSeed);
      this.centerOn(this.player());
    });
    const go = () => this.showSeed(this.seedInput.value.trim() || randomSeed());
    document.getElementById('map-go').addEventListener('click', go);
    this.seedInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') e.stopPropagation();
      if (e.key === 'Enter') go();
    });
    document.getElementById('map-rand').addEventListener('click', () => this.showSeed(randomSeed()));
    const objects = document.getElementById('map-objects');
    objects.checked = this.objectsOn;
    objects.addEventListener('change', () => {
      this.objectsOn = objects.checked;
      try { localStorage.setItem(OBJECTS_KEY, this.objectsOn ? '1' : '0'); } catch { /* stockage indisponible */ }
      this.dirty = true;
    });
    const rain = document.getElementById('map-rain');
    rain.checked = this.rainOn;
    rain.addEventListener('change', () => {
      this.rainOn = rain.checked;
      try { localStorage.setItem(RAIN_KEY, this.rainOn ? '1' : '0'); } catch { /* stockage indisponible */ }
      this.rainJob = null;
      this.dirty = true;
    });
  }

  // Autre graine : toujours un monde normal de la génération actuelle, sauf s'il s'agit
  // de la graine du monde en cours (on garde alors sa version du générateur).
  showSeed(seed) {
    const home = this.player && seed === this.homeSeed ? this.homeWorld : null;
    this.setWorld(home || { gtype: 'normal', seed, version: GEN_LATEST });
    const p = home && this.player();
    if (p) this.centerOn(p);
  }

  // On regarde le monde où l'on joue (flèche du joueur affichée)
  viewingHome() {
    return !!this.player && this.world.seed === this.homeSeed && this.world.version === this.homeWorld.version;
  }
}
