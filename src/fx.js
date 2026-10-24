// Effets visuels du jeu : de petites particules hexagonales (les mêmes que dans les cinématiques,
// voir Particles dans intro.js), qui rebondissent sur le sol.
//  - un bloc cassé vole en éclats (de la couleur de sa texture), les coups de pioche en
//    détachent des miettes ; un bloc posé soulève un peu de poussière ;
//  - poussière à l'atterrissage et sous les pieds quand on court ;
//  - éclaboussures quand on tombe dans l'eau ;
//  - un animal frappé, un animal qui meurt (un petit nuage) ;
//  - les miettes de ce qu'on mange ;
//  - des étincelles dorées : succès, niveau gagné.
import * as THREE from 'three';
import { Particles } from './intro.js?v=1.1.5-alpha-mvm2b95g';
import { BLOCKS } from './blocks.js?v=1.1.5-alpha-mvm2b95g';

const rr = (a, b) => a + Math.random() * (b - a);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const pick = (l) => l[Math.floor(Math.random() * l.length)];

// Particules qui tombent et rebondissent sur un sol (floor : hauteur, donnée à la naissance)
class Bits extends Particles {
  spawn(p, v, life, color, size, grow = 0, drag = 0, rise = 0, floor = -Infinity) {
    super.spawn(p, v, life, color, size, grow, drag, rise);
    this.list[this.list.length - 1].floor = floor;
  }
  update(dt) {
    for (const q of this.list) {
      if (q.floor === -Infinity || q.p.y + q.v.y * dt > q.floor) continue;
      // (rebond amorti, glisse un peu)
      q.p.y = q.floor;
      q.v.y = Math.abs(q.v.y) > 1.5 ? -q.v.y * 0.3 : 0;
      q.v.x *= 0.55; q.v.z *= 0.55;
      if (q.v.y === 0) q.rise = 0;
    }
    super.update(dt);
  }
}

export class GameFx {
  // atlas : les textures (pour la couleur des éclats) ; ground(x, y, z) : hauteur du sol sous ce
  // point (pour les rebonds)
  constructor(scene, atlas, ground = () => -Infinity) {
    this.atlas = atlas;
    this.ground = ground;
    this.bits = new Bits(scene, 1500, false);   // éclats, miettes, gouttes
    this.puffs = new Particles(scene, 600, false); // poussière, fumée
    this.glow = new Particles(scene, 500, true);   // étincelles (lumineuses)
    this.colors = new Map();
  }

  // Quelques couleurs prises dans la texture d'un bloc (au hasard parmi ses pixels opaques)
  colorsOf(id) {
    const b = BLOCKS[id];
    const name = b?.side || b?.top || b?.texture;
    if (this.colors.has(name)) return this.colors.get(name);
    let list = ['#8a8a8a', '#6f6f6f', '#9d9d9d'];
    const tile = name && this.atlas?.tiles?.[name];
    if (tile?.getContext) {
      try {
        const d = tile.getContext('2d').getImageData(0, 0, tile.width, tile.height).data;
        const found = [];
        for (let i = 0; i < 400 && found.length < 12; i++) {
          const k = Math.floor(Math.random() * (d.length / 4)) * 4;
          if (d[k + 3] > 200) found.push(`rgb(${d[k]},${d[k + 1]},${d[k + 2]})`);
        }
        if (found.length) list = found;
      } catch { /* (texture illisible : gris) */ }
    }
    this.colors.set(name, list);
    return list;
  }

  // Le bloc (id) de la case centrée en (x, z), de y à y + 1, vole en éclats
  breakBlock(x, y, z, id) {
    const cols = this.colorsOf(id), floor = this.ground(x, y + 0.5, z);
    for (let i = 0; i < 26; i++) {
      const p = V(x + rr(-0.45, 0.45), y + rr(0.1, 0.9), z + rr(-0.45, 0.45));
      const v = V(p.x - x, rr(0.5, 1.5), p.z - z).multiplyScalar(rr(2, 4));
      this.bits.spawn(p, v, rr(0.6, 1.1), pick(cols), rr(0.09, 0.17), 0, 0.5, -20, floor);
    }
  }
  // Un coup de pioche : quelques miettes qui sautent du point touché (n : normale de la face)
  dig(point, id, n = null) {
    const cols = this.colorsOf(id), floor = this.ground(point.x, point.y, point.z);
    for (let i = 0; i < 4; i++) {
      const v = V(rr(-1.5, 1.5), rr(1, 3), rr(-1.5, 1.5));
      if (n) v.addScaledVector(n, 2.5);
      this.bits.spawn(point, v, rr(0.35, 0.6), pick(cols), rr(0.06, 0.1), 0, 0.5, -18, floor);
    }
  }
  // Un bloc posé : un anneau de poussière à sa base
  place(x, y, z, id) {
    const cols = this.colorsOf(id);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.puffs.spawn(V(x + Math.cos(a) * 0.5, y + 0.05, z + Math.sin(a) * 0.5), V(Math.cos(a) * 1.2, rr(0.2, 0.6), Math.sin(a) * 1.2), rr(0.35, 0.55), pick(cols), rr(0.12, 0.2), 0.5, 3);
    }
  }
  // Poussière sous les pieds (atterrissage : force > 1 ; course : petite)
  dust(x, y, z, force = 1, id = 2) {
    const cols = this.colorsOf(id), n = Math.round(3 + force * 6);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rr(0.8, 1.6) * Math.min(2.5, force);
      this.puffs.spawn(V(x + Math.cos(a) * 0.3, y + 0.05, z + Math.sin(a) * 0.3), V(Math.cos(a) * s, rr(0.3, 0.9), Math.sin(a) * s), rr(0.35, 0.6), pick(cols), rr(0.06, 0.12), 0.25, 2.5);
    }
  }
  // Éclaboussures (on tombe dans l'eau en (x, y, z) : y, la surface)
  splash(x, y, z, strength = 1) {
    const n = Math.round(10 + strength * 20);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rr(1, 3) * Math.min(1.6, 0.6 + strength * 0.5);
      this.bits.spawn(V(x + Math.cos(a) * 0.3, y, z + Math.sin(a) * 0.3), V(Math.cos(a) * s, rr(3, 6) * Math.min(1.5, 0.5 + strength * 0.5), Math.sin(a) * s), rr(0.5, 0.9), pick(['#e8f4ff', '#bfdcf5', '#ffffff', '#9cc7ec']), rr(0.07, 0.13), 0, 0.3, -20, y - 0.2);
    }
    for (let i = 0; i < 8; i++) this.puffs.spawn(V(x + rr(-0.5, 0.5), y + 0.05, z + rr(-0.5, 0.5)), V(rr(-0.5, 0.5), 0.3, rr(-0.5, 0.5)), rr(0.6, 1), '#f2f8ff', rr(0.3, 0.5), 0.6, 2);
  }
  // Un animal frappé (au point x, y, z) : éclats rouges et quelques étoiles
  hit(x, y, z) {
    const floor = this.ground(x, y, z);
    for (let i = 0; i < 8; i++) this.bits.spawn(V(x, y, z), V(rr(-2, 2), rr(1.5, 3.5), rr(-2, 2)), rr(0.4, 0.7), pick(['#c0392b', '#e74c3c', '#962d22']), rr(0.06, 0.11), 0, 0.5, -16, floor);
    for (let i = 0; i < 4; i++) this.glow.spawn(V(x, y + 0.3, z), V(rr(-1.5, 1.5), rr(0.5, 2), rr(-1.5, 1.5)), rr(0.25, 0.4), '#ffe9a8', rr(0.08, 0.12), 0, 2);
  }
  // Un animal meurt : un petit nuage blanc
  poof(x, y, z) {
    for (let i = 0; i < 22; i++) this.puffs.spawn(V(x + rr(-0.4, 0.4), y + rr(0.1, 1.1), z + rr(-0.4, 0.4)), V(rr(-1.2, 1.2), rr(0.4, 1.6), rr(-1.2, 1.2)), rr(0.6, 1.1), pick(['#ffffff', '#e6e6e6', '#cfcfcf']), rr(0.25, 0.45), 0.6, 2.5, 0.6);
  }
  // Ce qu'on mange : des miettes devant la bouche (from : devant les yeux, id : la nourriture)
  crumbs(from, id, color = null) {
    const cols = color ? [color] : this.colorsOf(id);
    for (let i = 0; i < 7; i++) this.bits.spawn(from, V(rr(-1, 1), rr(0.5, 2), rr(-1, 1)), rr(0.4, 0.6), pick(cols), rr(0.04, 0.07), 0, 0.5, -14);
  }
  // Étincelles dorées qui montent en spirale autour de (x, y, z) : succès, niveau gagné
  sparkle(x, y, z, big = false) {
    const n = big ? 70 : 36;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 6, r = rr(0.5, 1);
      this.glow.spawn(V(x + Math.cos(a) * r, y + (i / n) * 1.5, z + Math.sin(a) * r), V(-Math.sin(a) * 1.5, rr(1, 2.5), Math.cos(a) * 1.5), rr(0.8, 1.4), pick(big ? ['#ffd34d', '#fff1a8', '#7fe0ff'] : ['#ffd34d', '#fff1a8', '#ffb347']), rr(0.08, 0.15), 0, 1.2);
    }
  }

  update(dt) {
    // (rien à l'écran : on ne renvoie pas les tampons à la carte graphique à chaque image)
    for (const p of [this.bits, this.puffs, this.glow]) {
      if (!p.list.length && p.idle) continue;
      p.idle = !p.list.length;
      p.update(dt);
    }
  }
}
