// Satellites de cartographie. On le lâche en orbite (en main, clic droit, dans l'espace au-dessus d'une
// planète où l'on peut se poser) : il tourne autour d'elle tout seul, que quelqu'un soit là ou non, et
// cartographie le sol qu'il survole. Son orbite passe presque par les pôles et tourne lentement
// (15° par tour) : en une douzaine de tours (une demi-heure), il a vu toute la planète.
//  - La carte du monde se dévoile (en survie, elle ne montre que ce qu'on a exploré ou scanné) :
//    par grandes cases de SAT_CELL blocs, un peu voilées comme celles du scanner.
//  - Les biomes qu'il survole sont repérés dans le carnet ; un gisement par passage est noté
//    (pour les relever tous, le scanner orbital reste plus précis).
//  - Dans l'espace, on le voit passer : un petit point qui clignote au-dessus de la planète.
//  - La console de satellites (module observatoire) donne leur état.
// L'orbite est comptée dans le repère de la planète (elle tourne avec elle) : le point vu dans le ciel
// est toujours au-dessus du sol qu'il cartographie. Tout se fait chez l'hôte.
import * as THREE from 'three';
import { BODY, spanOf, spinAngle } from './system.js?v=1.1.0-mx09tneh';
import { ZONE, bodyZone } from './spacegen.js?v=1.1.0-mx09tneh';
import { dirToWorld } from './planetview.js?v=1.1.0-mx09tneh';

export const SATELLITE = 4606;
export const SAT_CELL = 1024;       // (case de la carte dévoilée : blocs)
const SAT_R = 3600;                 // (rayon de ce qu'il voit sous lui : blocs)
const ORBIT_S = 150;                // (un tour : secondes)
const PREC = 24;                    // (l'orbite tourne d'un tour complet en 24 tours du satellite)
const EVERY = 5;                    // (un relevé toutes les 5 s)
const ALT = [300, 150000];          // (altitude où on peut le lâcher : blocs au-dessus du sol)
export const SAT_ALT = ALT;
const AXIS_Y = new THREE.Vector3(0, 1, 0), AXIS_Z = new THREE.Vector3(0, 0, 1);

// Les cases de la carte d'une planète (pour le pourcentage)
const totalCells = (b) => Math.ceil(spanOf(b) / SAT_CELL) * Math.ceil(spanOf(b) / 2 / SAT_CELL);

export class Satellites {
  constructor() { this.reset(); }
  reset() {
    this.list = [];          // { id, name, b (astre), alt, e1, e2 (le plan de l'orbite), u (où il en est), om (rotation du plan), t (avant le prochain relevé), n (relevés) }
    this.cells = new Map();  // astre -> Set des cases dévoilées ('x,z' en cases de SAT_CELL, x compté avec sa zone)
    this.done = new Set();   // astres dont on a annoncé : 25, 50, 75, 100 % ('id:25')
    this.next = 1;
  }
  serialize() {
    return {
      next: this.next,
      list: this.list.map((s) => ({ ...s, e1: s.e1.map((v) => +v.toFixed(5)), e2: s.e2.map((v) => +v.toFixed(5)), u: +s.u.toFixed(4), om: +s.om.toFixed(4) })),
      cells: Object.fromEntries([...this.cells].map(([b, set]) => [b, [...set].join(';')])),
      done: [...this.done],
    };
  }
  load(d) {
    this.reset();
    if (!d || typeof d !== 'object') return;
    this.next = Number.isInteger(d.next) ? d.next : 1;
    for (const s of Array.isArray(d.list) ? d.list : []) {
      if (!BODY[s?.b] || !Array.isArray(s.e1) || !Array.isArray(s.e2)) continue;
      this.list.push({ id: s.id, name: String(s.name || 'Satellite').slice(0, 40), b: s.b, alt: +s.alt || 2000, e1: s.e1.map(Number), e2: s.e2.map(Number), u: +s.u || 0, om: +s.om || 0, t: +s.t || 0, n: s.n | 0 });
    }
    for (const [b, txt] of Object.entries(d.cells || {})) {
      if (typeof txt === 'string' && txt) this.cells.set(b, new Set(txt.split(';').filter((k) => /^-?\d+,-?\d+$/.test(k))));
    }
    for (const k of Array.isArray(d.done) ? d.done : []) this.done.add(String(k));
  }
  // La part de la planète cartographiée (0 à 1)
  coverage(bid) { const b = BODY[bid]; return b ? Math.min(1, (this.cells.get(bid)?.size || 0) / totalCells(b)) : 0; }
  cellsOf(bid) { return this.cells.get(bid) || null; }

  // Le lâcher : g, le sol sous soi (voir spaceflight.groundUnder : { b, k, x, z, alt }). Renvoie le
  // satellite, ou un message d'erreur
  deploy(g) {
    if (!g?.b || !(g.b.gen || g.b.kind === 'home')) return 'Un satellite se lâche en orbite, au-dessus d\'une planète où l\'on peut se poser';
    if (g.alt < ALT[0]) return 'Trop près du sol : monte au-dessus de ' + ALT[0] + ' blocs';
    if (g.alt > ALT[1]) return `Trop loin de ${g.b.name} : rapproche-toi (moins de ${ALT[1].toLocaleString('fr-FR')} blocs)`;
    // le point sous soi (repère de la planète), et le plan de l'orbite : par ce point, presque vers le nord
    const span = spanOf(g.b), lon = -((g.x - g.k * ZONE) / span) * Math.PI * 2, lat = Math.max(-1.5, Math.min(1.5, (-g.z / (span * 0.5)) * Math.PI));
    const e1 = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
    const north = new THREE.Vector3(0, 1, 0).applyAxisAngle(AXIS_Z, 0.14); // (presque polaire : 82°)
    const e2 = north.sub(e1.clone().multiplyScalar(north.dot(e1))).normalize();
    const s = { id: this.next++, name: 'Satellite ' + (this.list.length + 1), b: g.b.id, alt: Math.round(g.alt), e1: e1.toArray(), e2: e2.toArray(), u: 0, om: 0, t: 0, n: 0 };
    this.list.push(s);
    return s;
  }
  // La direction du satellite, dans le repère de la planète
  dirOf(s, out = new THREE.Vector3()) {
    const c = Math.cos(s.u), si = Math.sin(s.u);
    out.set(s.e1[0] * c + s.e2[0] * si, s.e1[1] * c + s.e2[1] * si, s.e1[2] * c + s.e2[2] * si).normalize();
    return out.applyAxisAngle(AXIS_Y, s.om);
  }
  // (hôte) Le temps passe : ils tournent ; toutes les EVERY secondes, chacun cartographie ce qu'il
  // survole. scan(b, x, z) : les biomes et les gisements d'un point du sol (voir main.js).
  // Renvoie les annonces ({ b, pct }) : 25, 50, 75 et 100 % d'une planète
  tick(dt, scan) {
    const news = [];
    const d = this._d ||= new THREE.Vector3();
    for (const s of this.list) {
      s.u = (s.u + dt * Math.PI * 2 / ORBIT_S) % (Math.PI * 2);
      s.om = (s.om + dt * Math.PI * 2 / (ORBIT_S * PREC)) % (Math.PI * 2);
      if ((s.t += dt) < EVERY) continue;
      s.t = 0;
      s.n++;
      const b = BODY[s.b];
      if (!b) continue;
      const span = spanOf(b), k = b.kind === 'home' ? 0 : bodyZone(b.id), w = dirToWorld(this.dirOf(s, d), span);
      const x = w.x + k * ZONE, z = w.z;
      // les cases vues : un disque de SAT_R blocs, plus large en x près des pôles (la carte s'y étire)
      let set = this.cells.get(s.b);
      if (!set) this.cells.set(s.b, (set = new Set()));
      const lat = Math.abs(d.y), rx = SAT_R / Math.max(0.08, Math.sqrt(1 - lat * lat)), rz = SAT_R;
      const x0 = Math.floor((x - rx) / SAT_CELL), x1 = Math.floor((x + rx) / SAT_CELL), z0 = Math.floor((z - rz) / SAT_CELL), z1 = Math.floor((z + rz) / SAT_CELL);
      const half = span / 2, xmin = k * ZONE - half, xmax = k * ZONE + half;
      for (let cx = x0; cx <= x1; cx++) {
        for (let cz = z0; cz <= z1; cz++) {
          const px = (cx + 0.5) * SAT_CELL, pz = (cz + 0.5) * SAT_CELL;
          if (((px - x) / rx) ** 2 + ((pz - z) / rz) ** 2 > 1.15) continue;
          // (au bord de la carte : elle fait le tour de la planète, on repasse de l'autre côté)
          let qx = px;
          if (qx < xmin) qx += span; else if (qx > xmax) qx -= span;
          if (Math.abs(pz) > span / 4 + SAT_CELL) continue;
          set.add(Math.floor(qx / SAT_CELL) + ',' + cz);
        }
      }
      scan?.(b, x, z, SAT_R);
      const pct = this.coverage(s.b);
      for (const p of [25, 50, 75, 100]) {
        if (pct * 100 < (p === 100 ? 99 : p) || this.done.has(s.b + ':' + p)) continue;
        this.done.add(s.b + ':' + p);
        news.push({ b, pct: p, s });
      }
    }
    return news;
  }
  // Leur place dans le système (pour le ciel, voir skyview.js) : [{ x, y, z }] ; bodyPos(id) : le
  // centre d'un astre ce jour-là
  positions(bodyPos, day, seed) {
    const out = [], d = new THREE.Vector3(), q = new THREE.Quaternion(), qz = new THREE.Quaternion();
    for (const s of this.list) {
      const b = BODY[s.b];
      if (!b) continue;
      const o = bodyPos(b.id, day, seed);
      // (comme spaceflight.bodyQ : l'inclinaison de l'astre, sa rotation)
      q.setFromAxisAngle(AXIS_Y, spinAngle(b, day, seed)).premultiply(qz.setFromAxisAngle(AXIS_Z, b.tilt || 0));
      this.dirOf(s, d).applyQuaternion(q).multiplyScalar(b.R + s.alt);
      out.push({ x: o.x + d.x, y: o.y + d.y, z: o.z + d.z, id: s.id });
    }
    return out;
  }
}
