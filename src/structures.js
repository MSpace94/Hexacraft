// Bloc de structure : enregistre une zone du monde (sauvegarder) et la reconstruit ailleurs
// (charger), avec une rotation par pas de 60°. Les structures sont des fichiers .json dans
// le dossier « structures » du jeu : on les partage en copiant ces fichiers.
//
// Zone : un « rectangle » de cases (colonnes X vers l'est, rangées Z vers le sud), à partir
// d'un décalage par rapport au bloc de structure. Les blocs sont gardés en coordonnées
// hexagonales relatives au premier coin : la forme est identique où qu'on la recharge.
import * as THREE from 'three';
import { hexToWorld } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { BLOCKS, AIR, ATTACHED, hasParams, isWater } from './blocks.js?v=1.1.5-alpha-mvm2b95g';

export const STRUCTURE_BLOCK = 82;
export const MAX_SIZE = 64;           // côté maximal d'une zone (X et Z), en cases
const MAX_BLOCKS = 250000;
const NAME_RE = /^[\p{L}\p{N} _-]{1,40}$/u;
const LOCAL_KEY = 'hexacraft.structures'; // (sans l'application : gardées dans le navigateur)

// Colonne / rangée (« odd-r ») <-> coordonnées axiales
const par = (r) => ((r % 2) + 2) % 2;
const toCol = (q, r) => q + (r - par(r)) / 2;
const toQ = (col, r) => col - (r - par(r)) / 2;

export const validName = (n) => typeof n === 'string' && NAME_RE.test(n) && n.trim() === n;

// ---------- Rangement ----------
const native = typeof window !== 'undefined' ? window.hexaNative : null;
function localAll() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch { return {}; } }
export const store = {
  list() {
    const files = native?.listStructures ? native.listStructures() : Object.entries(localAll()).map(([name, text]) => ({ name, text }));
    const out = [];
    for (const f of files) {
      try {
        const d = JSON.parse(f.text);
        if (Array.isArray(d.blocks)) out.push({ name: f.name, data: d });
      } catch { /* fichier abîmé : ignoré */ }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  },
  write(name, data) {
    const text = JSON.stringify(data);
    if (native?.writeStructure) return native.writeStructure(name, text);
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...localAll(), [name]: text })); return true; } catch { return false; }
  },
  remove(name) {
    if (native?.deleteStructure) return native.deleteStructure(name);
    const all = localAll();
    delete all[name];
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(all)); } catch { /* ignoré */ }
    return true;
  },
  openFolder() { native?.openStructures?.(); return !!native?.openStructures; },
};

// ---------- Zone ----------
// Cases (q, r, y) de la zone : bloc de structure en (q0, r0, y0), décalage o et taille s
// ({ x, y, z }, en cases ; X : colonnes, Z : rangées)
export function regionCells(q0, r0, y0, o, s) {
  const c0 = toCol(q0, r0) + o.x, row0 = r0 + o.z, out = [];
  for (let dz = 0; dz < s.z; dz++) {
    const r = row0 + dz;
    for (let dx = 0; dx < s.x; dx++) {
      const q = toQ(c0 + dx, r);
      for (let dy = 0; dy < s.y; dy++) out.push([q, r, y0 + o.y + dy]);
    }
  }
  return out;
}

// Enregistre la zone. Renvoie la structure (air non gardé)
export function capture(world, structs, q0, r0, y0, o, s) {
  const cells = regionCells(q0, r0, y0, o, s);
  const [oq, or, oy] = cells[0];
  const blocks = [], params = [];
  for (const [q, r, y] of cells) {
    const id = world.getBlock(q, r, y);
    // (l'eau qui coule n'est pas gardée : elle se refait toute seule depuis les sources)
    if (id === AIR || id === STRUCTURE_BLOCK || !BLOCKS[id] || (isWater(id) && id !== 7)) continue;
    blocks.push([q - oq, r - or, y - oy, id]);
    const p = hasParams(id) && structs?.worldParams.get(q + ',' + r + ',' + y);
    if (p) params.push([q - oq, r - or, y - oy, p]);
    if (blocks.length >= MAX_BLOCKS) break;
  }
  return { v: 1, size: [s.x, s.y, s.z], blocks, params };
}

// Rotation de (q, r) autour de l'origine, de k fois 60° (sens des aiguilles d'une montre)
function rotate(q, r, k) {
  for (let i = 0; i < ((k % 6) + 6) % 6; i++) [q, r] = [-r, q + r];
  return [q, r];
}

// Cases où la structure irait : premier coin à la case de la zone de départ (même décalage
// que pour sauvegarder), tournée de rot x 60° autour de ce coin
export function placement(data, q0, r0, y0, o, rot) {
  const [oq, or, oy] = regionCells(q0, r0, y0, o, { x: 1, y: 1, z: 1 })[0];
  return data.blocks.map(([dq, dr, dy, id]) => {
    const [rq, rr] = rotate(dq, dr, rot);
    return [oq + rq, or + rr, oy + dy, id];
  });
}

// Construit la structure dans le monde. Renvoie le nombre de blocs posés
export function place(world, structs, data, q0, r0, y0, o, rot) {
  const cells = placement(data, q0, r0, y0, o, rot);
  // blocs pleins du bas vers le haut, puis ce qui se pose dessus (rails, torches...)
  cells.sort((a, b) => (ATTACHED[a[3]] - ATTACHED[b[3]]) || a[2] - b[2]);
  let n = 0;
  for (const [q, r, y, id] of cells) {
    if (!BLOCKS[id] || id === STRUCTURE_BLOCK) continue;
    if (world.setBlock(q, r, y, id)) n++;
  }
  // réglages des blocs physiques et gravitrons
  const [oq, or, oy] = regionCells(q0, r0, y0, o, { x: 1, y: 1, z: 1 })[0];
  for (const [dq, dr, dy, p] of data.params || []) {
    const [rq, rr] = rotate(dq, dr, rot);
    if (Array.isArray(p) && p.every(Number.isFinite)) structs?.worldParams.set((oq + rq) + ',' + (or + rr) + ',' + (oy + dy), p);
  }
  return n;
}

// ---------- Aperçu : boîte autour des cases ----------
export class RegionPreview {
  constructor(scene) {
    this.box = new THREE.Box3();
    this.helper = new THREE.Box3Helper(this.box, 0x3cdcff);
    this.helper.material.depthTest = false;
    this.helper.material.transparent = true;
    this.helper.renderOrder = 6;
    this.helper.visible = false;
    scene.add(this.helper);
  }
  show(cells) {
    if (!cells.length) { this.hide(); return; }
    const b = this.box.makeEmpty(), v = new THREE.Vector3();
    for (const [q, r, y] of cells) {
      const c = hexToWorld(q, r);
      b.expandByPoint(v.set(c.x - 0.58, y, c.z - 0.58));
      b.expandByPoint(v.set(c.x + 0.58, y + 1, c.z + 0.58));
    }
    this.helper.visible = true;
  }
  hide() { this.helper.visible = false; }
}
