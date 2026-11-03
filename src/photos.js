// Photos : l'appareil photo (clic droit) prend la vue sur une feuille de papier photo. La photo
// se tient en main (clic droit dans le vide : on la regarde en grand) ou s'accroche à un mur (un
// cadre de bois, voir PHOTO_FRAME dans blocks.js). Chaque photo a un numéro, gardé dans l'usure w
// de l'objet (voir makeSlot) ; les images et les photos accrochées sont sauvegardées avec le monde.
import * as THREE from 'three';
import { hexToWorld } from './hex.js?v=1.1.5-alpha-mw17vbxj';

export const PHOTO_W = 320, PHOTO_H = 240;
const MAX_PHOTOS = 400; // (au-delà, les plus anciennes qui ne sont accrochées nulle part s'en vont)

export class Photos {
  constructor(scene) {
    this.images = new Map();  // numéro -> image (data URL, JPEG)
    this.frames = new Map();  // "q,r,y" -> { id, k } (k : côté du mur, comme les torches murales)
    this.next = 1;
    this.last = 0;            // (la dernière prise : celle qu'on accroche en créatif)
    this.group = new THREE.Group();
    scene.add(this.group);
    this.meshes = new Map();  // "q,r,y" -> cadre dessiné
    this.tex = new Map();     // numéro -> texture
    this.wood = new THREE.MeshLambertMaterial({ color: 0x5a3c22 });
    this.blank = new THREE.MeshLambertMaterial({ color: 0xd8d4c8 });
    // (la face d'un hexagone fait 0,577 de large)
    this.frameGeo = new THREE.BoxGeometry(0.56, 0.46, 0.05);
    this.picGeo = new THREE.PlaneGeometry(0.5, 0.375);
  }

  // Une photo de ce que montre la toile (juste après le rendu de la scène, sans la main) : le
  // milieu de l'écran, au format 4/3. Renvoie son numéro.
  capture(canvas) {
    const c = document.createElement('canvas');
    c.width = PHOTO_W; c.height = PHOTO_H;
    const W = canvas.width, H = canvas.height, k = Math.min(W / 4, H / 3), w = k * 4, h = k * 3;
    const x = c.getContext('2d');
    x.drawImage(canvas, (W - w) / 2, (H - h) / 2, w, h, 0, 0, PHOTO_W, PHOTO_H);
    const id = this.next++;
    this.images.set(id, c.toDataURL('image/jpeg', 0.82));
    this.last = id;
    this.trim();
    return id;
  }
  trim() {
    if (this.images.size <= MAX_PHOTOS) return;
    const hung = new Set([...this.frames.values()].map((f) => f.id));
    for (const id of this.images.keys()) {
      if (this.images.size <= MAX_PHOTOS) break;
      if (!hung.has(id)) { this.images.delete(id); this.tex.get(id)?.dispose(); this.tex.delete(id); }
    }
  }
  texture(id) {
    let t = this.tex.get(id);
    if (t || !this.images.has(id)) return t || null;
    t = new THREE.TextureLoader().load(this.images.get(id));
    t.colorSpace = THREE.SRGBColorSpace;
    this.tex.set(id, t);
    return t;
  }

  // ---------- Accrochées aux murs ----------
  hang(q, r, y, k, id) {
    const key = q + ',' + r + ',' + y;
    this.unhang(key);
    this.frames.set(key, { id, k });
    this.draw(key);
  }
  // La photo du cadre key s'en va (renvoie son numéro, ou 0)
  unhang(key) {
    const f = this.frames.get(key);
    const m = this.meshes.get(key);
    if (m) { this.group.remove(m); m.children[1]?.material?.dispose(); this.meshes.delete(key); }
    this.frames.delete(key);
    return f?.id || 0;
  }
  draw(key) {
    const f = this.frames.get(key);
    if (!f) return;
    const [q, r, y] = key.split(',').map(Number), c = hexToWorld(q, r), a = (Math.PI / 3) * f.k;
    const g = new THREE.Group();
    const frame = new THREE.Mesh(this.frameGeo, this.wood);
    const t = this.texture(f.id);
    const pic = new THREE.Mesh(this.picGeo, t ? new THREE.MeshLambertMaterial({ map: t }) : this.blank.clone());
    pic.position.z = 0.03;
    g.add(frame, pic);
    // (contre le mur, tourné vers la pièce)
    g.position.set(c.x + Math.cos(a) * 0.47, y + 0.5, c.z + Math.sin(a) * 0.47);
    g.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
    this.group.add(g);
    this.meshes.set(key, g);
  }

  // ---------- Sauvegarde ----------
  serialize() {
    return { next: this.next, last: this.last, images: [...this.images], frames: [...this.frames].map(([k, f]) => [k, f.id, f.k]) };
  }
  clear() {
    for (const k of [...this.frames.keys()]) this.unhang(k);
    for (const t of this.tex.values()) t.dispose();
    this.tex.clear();
    this.images.clear();
    this.next = 1;
    this.last = 0;
  }
  load(d) {
    this.clear();
    if (!d) return;
    for (const e of Array.isArray(d.images) ? d.images : []) {
      if (Array.isArray(e) && Number.isInteger(e[0]) && typeof e[1] === 'string' && e[1].startsWith('data:image/')) this.images.set(e[0], e[1]);
    }
    this.next = Math.max(Number.isInteger(d.next) ? d.next : 1, ...[...this.images.keys()].map((i) => i + 1), 1);
    this.last = Number.isInteger(d.last) ? d.last : 0;
    for (const e of Array.isArray(d.frames) ? d.frames : []) {
      if (!Array.isArray(e) || typeof e[0] !== 'string' || !Number.isInteger(e[1]) || !Number.isInteger(e[2]) || e[2] < 0 || e[2] > 5) continue;
      if (e[0].split(',').length !== 3) continue;
      this.frames.set(e[0], { id: e[1], k: e[2] });
      this.draw(e[0]);
    }
  }
}
