// Étiquettes des émetteurs et récepteurs de voltite : au-dessus de chacun (à moins de NEAR blocs),
// l'icône de sa fréquence dans un hexagone. Orange : un émetteur (triangle vers le haut : il
// envoie), cyan : un récepteur (triangle vers le bas : il reçoit) ; la bordure brille quand
// l'émetteur est alimenté, quand le récepteur capte. On voit d'un coup d'œil qui parle à qui, sans
// ouvrir de menu. (Un bloc posé dessus : l'étiquette passe devant le côté tourné vers le joueur.)
import * as THREE from 'three';
import { BLOCKS, AIR, RADIO_RX_ON } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { hexToWorld } from './hex.js?v=1.1.5-alpha-mwgq2wrb';

const NEAR = 28, FADE = 6, MAX = 64, EVERY = 0.2, SIZE = 0.68;
const COLORS = { tx: ['#8a6430', '#ffb040'], rx: ['#2a7888', '#3fd6ee'] };

export class RadioTags {
  constructor(scene, world, circuits, iconOf) {
    this.scene = scene;
    this.world = world;
    this.circuits = circuits;
    this.iconOf = iconOf;
    this.tex = new Map(); // "fréquence|tx/rx|allumé" -> texture
    this.pool = [];
    this.t = EVERY;
  }

  texture(f, kind, on) {
    const key = f + '|' + kind + '|' + (on ? 1 : 0);
    let t = this.tex.get(key);
    if (t) return t;
    const S = 64, c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d'), col = COLORS[kind][on ? 1 : 0];
    const hex = (rad) => {
      x.beginPath();
      for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 6; x.lineTo(S / 2 + rad * Math.cos(a), S / 2 + rad * Math.sin(a)); }
      x.closePath();
    };
    hex(28);
    x.fillStyle = 'rgba(10, 16, 24, 0.86)';
    x.fill();
    if (on) { x.shadowColor = col; x.shadowBlur = 8; }
    x.strokeStyle = col;
    x.lineWidth = 4;
    x.stroke();
    x.shadowBlur = 0;
    const icon = f ? this.iconOf(f) : null;
    if (icon) x.drawImage(icon, 12, 12, 40, 40);
    else { x.fillStyle = '#c8d4dc'; x.font = 'bold 30px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', S / 2, S / 2 + 1); }
    // (le sens : vers le haut, il envoie ; vers le bas, il reçoit)
    x.fillStyle = col;
    x.beginPath();
    if (kind === 'tx') { x.moveTo(52, 4); x.lineTo(61, 17); x.lineTo(43, 17); } else { x.moveTo(43, 4); x.lineTo(61, 4); x.lineTo(52, 17); }
    x.closePath();
    x.fill();
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    this.tex.set(key, t);
    return t;
  }

  sprite(i) {
    let s = this.pool[i];
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false }));
      s.scale.setScalar(SIZE);
      s.renderOrder = 5;
      this.scene.add(s);
      this.pool[i] = s;
    }
    return s;
  }

  // (eye : la position de l'œil du joueur, dans le monde)
  update(dt, eye, hidden) {
    this.t += dt;
    if (this.t < EVERY) return;
    this.t = 0;
    const list = [];
    if (!hidden) {
      for (const [k, f] of this.circuits.radio) {
        const i1 = k.indexOf(','), i2 = k.indexOf(',', i1 + 1);
        const q = +k.slice(0, i1), r = +k.slice(i1 + 1, i2), y = +k.slice(i2 + 1);
        if (Math.abs(y - eye.y) > NEAR) continue;
        const p = hexToWorld(q, r), dx = p.x - eye.x, dz = p.z - eye.z, d2 = dx * dx + dz * dz + (y + 0.5 - eye.y) ** 2;
        if (d2 > NEAR * NEAR) continue;
        const id = this.world.getBlock(q, r, y), kind = BLOCKS[id]?.radio;
        if (!kind) continue;
        list.push({ q, r, y, x: p.x, z: p.z, d: Math.sqrt(d2), f, kind, on: kind === 'tx' ? this.circuits.txOn.has(k) : id === RADIO_RX_ON });
      }
      if (list.length > MAX) { list.sort((a, b) => a.d - b.d); list.length = MAX; }
    }
    let n = 0;
    for (const o of list) {
      const s = this.sprite(n++);
      s.material.map = this.texture(o.f, o.kind, o.on);
      s.material.opacity = Math.min(1, (NEAR - o.d) / FADE);
      s.material.needsUpdate = true;
      if (this.world.getBlock(o.q, o.r, o.y + 1) === AIR) s.position.set(o.x, o.y + 1.36, o.z);
      else {
        // (recouvert : devant le côté tourné vers le joueur)
        const dx = eye.x - o.x, dz = eye.z - o.z, l = Math.hypot(dx, dz) || 1;
        s.position.set(o.x + (dx / l) * 1.02, o.y + 0.5, o.z + (dz / l) * 1.02);
      }
      s.visible = true;
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i].visible = false;
  }

  clear() { for (const s of this.pool) s.visible = false; }
}
