// Boules de neige lancées (clic droit avec une boule de neige en main) : elles volent en
// cloche, et éclatent en flocons sur le premier bloc touché.
import * as THREE from 'three';
import { SOLID, blockBox } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { worldToHex } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { DEPTH } from './gen.js?v=1.1.5-alpha-mvm2b95g';

const SPEED = 24;       // vitesse au lancer (blocs/s)
const GRAVITY = 16;     // chute (blocs/s²)
const DRAG = 0.4;       // freinage de l'air (par seconde)
const LIFE = 8;         // au plus 8 s en vol
const STEP = 0.12;      // pas des tests de collision (pas de passe-muraille à grande vitesse)
const FLAKES = 10;      // flocons à l'impact

// Petit carré blanc légèrement bleuté (flocon)
function flakeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#eef8fb';
  ctx.fillRect(1, 1, 6, 6);
  ctx.fillStyle = '#c9e4ea';
  ctx.fillRect(4, 4, 3, 3);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class SnowballSystem {
  // icon : canvas de l'icône de la boule de neige (vue toujours de face, comme dans Minecraft)
  constructor(scene, world, icon) {
    this.scene = scene;
    this.world = world;
    const tex = new THREE.CanvasTexture(icon);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.ballMat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.3 });
    this.flakeMat = new THREE.SpriteMaterial({ map: flakeTexture(), transparent: true, depthWrite: false });
    this.balls = [];
    this.flakes = [];
  }

  // Lance une boule depuis `from` dans la direction `dir` (+ la vitesse du lanceur)
  throw(from, dir, inherit) {
    const sprite = new THREE.Sprite(this.ballMat);
    sprite.scale.setScalar(0.3);
    sprite.position.copy(from);
    this.scene.add(sprite);
    const vel = dir.clone().normalize().multiplyScalar(SPEED);
    if (inherit) vel.addScaledVector(inherit, 0.5);
    vel.y += 1.5; // un peu vers le haut, pour la cloche
    this.balls.push({ sprite, vel, age: 0 });
  }

  // Bloc solide au point p ? (une dalle n'occupe que sa moitié)
  solidAt(p) {
    const { q, r } = worldToHex(p.x, p.z);
    const y = Math.floor(p.y);
    const id = this.world.getBlock(q, r, y);
    if (!SOLID[id]) return false;
    const [lo, hi] = blockBox(id);
    const fy = p.y - y;
    return fy >= lo && fy < hi;
  }

  burst(p) {
    for (let i = 0; i < FLAKES; i++) {
      const s = new THREE.Sprite(this.flakeMat);
      s.scale.setScalar(0.07 + Math.random() * 0.05);
      s.position.copy(p);
      const a = Math.random() * Math.PI * 2, up = Math.random();
      const v = new THREE.Vector3(Math.cos(a) * (1 + Math.random() * 2), 1 + up * 2.5, Math.sin(a) * (1 + Math.random() * 2));
      this.scene.add(s);
      this.flakes.push({ s, v, age: 0, life: 0.35 + Math.random() * 0.3 });
    }
  }

  update(dt) {
    const tmp = new THREE.Vector3();
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.age += dt;
      b.vel.y -= GRAVITY * dt;
      b.vel.multiplyScalar(Math.max(0, 1 - DRAG * dt));
      // avance par petits pas pour ne jamais traverser un bloc
      const dist = b.vel.length() * dt;
      const n = Math.max(1, Math.ceil(dist / STEP));
      let hit = false;
      for (let k = 0; k < n; k++) {
        tmp.copy(b.sprite.position).addScaledVector(b.vel, dt / n);
        if (this.solidAt(tmp)) { hit = true; break; }
        b.sprite.position.copy(tmp);
      }
      if (hit || b.age > LIFE || b.sprite.position.y < -DEPTH - 20) {
        if (hit) this.burst(b.sprite.position);
        this.scene.remove(b.sprite);
        this.balls.splice(i, 1);
      }
    }
    for (let i = this.flakes.length - 1; i >= 0; i--) {
      const f = this.flakes[i];
      f.age += dt;
      f.v.y -= 12 * dt;
      f.s.position.addScaledVector(f.v, dt);
      if (f.age > f.life) {
        this.scene.remove(f.s);
        this.flakes.splice(i, 1);
      }
    }
  }

  // Vide tout (changement de monde)
  clear() {
    for (const b of this.balls) this.scene.remove(b.sprite);
    for (const f of this.flakes) this.scene.remove(f.s);
    this.balls.length = 0;
    this.flakes.length = 0;
  }
}
