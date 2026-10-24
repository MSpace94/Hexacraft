import * as THREE from 'three';
import { DEPTH } from './gen.js?v=1.1.5-alpha-mvm2b95g';
import { worldToHex, hexToWorld, NEIGHBORS } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { buildCharacter, crouchPose, setHat } from './character.js?v=1.1.5-alpha-mvm2b95g';
import { isWater, isIceWater, SOLID, blockBox, BLOCKS, blockPush as cellPush, blockOverlap as cellOverlap, solidSpan } from './blocks.js?v=1.1.5-alpha-mvm2b95g';

// Rayon du joueur. Entre deux hexas dont les pointes se font face, le passage ne fait
// que 0.577 bloc de large : avec 0.26 (largeur 0.52), on s'y faufile.
export const RADIUS = 0.26;
export const HEIGHT = 1.8;
export const EYE = 1.62;
// Accroupi (Maj au sol) : on avance lentement, on ne tombe pas du bord d'un bloc, les yeux
// descendent de SNEAK_DROP
export const SNEAK_DROP = 0.3;
const SNEAK = 1.3;

const WALK = 4.3, SPRINT = 5.8, FLY = 10, FLY_SPRINT = 18;
const GRAVITY = 30, JUMP = 8.6;
const SWIM_OUT = 10.5; // élan pour sortir de l'eau sur une rive (jusqu'à 1 bloc au-dessus de la surface)
const CELLS = [[0, 0], ...NEIGHBORS];
// (collisions avec un bloc : toute la case, ou la moitié d'une dalle verticale ; voir blocks.js)
const STEP_UP = 0.51; // marche franchie en marchant (une dalle)

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.fly = false;
    this.sprint = false;
    this.sprintFactor = 1; // (1 : course normale ; moins quand on a faim, voir survival.js)
    this.walkPhase = 0;
    this.sneak = false;  // accroupi
    this.crouch = 0;     // 0 debout .. 1 accroupi (en douceur, pour la caméra et le corps)
    this.model = new THREE.Group(); // rempli par loadSkin()
    this.model.visible = false;
  }

  async loadSkin(url) {
    const character = await buildCharacter(url);
    character.traverse((o) => { if (o.isMesh) o.userData.skin = true; });
    this.model.clear();
    this.model.add(character);
    this.parts = character.userData.parts;
    this.firstPerson = null; // (le nouveau corps reprendra le bon matériau)
    setHat(this.parts, this.hat || 0);
  }
  // Chapeau porté (voir character.setHat) : id de l'objet, ou 0
  wear(id) {
    this.hat = id || 0;
    setHat(this.parts, this.hat);
    this.firstPerson = null; // (le chapeau suit la 1re personne, comme le corps)
  }

  // En 1re personne le personnage reste présent pour projeter son ombre, mais n'est
  // pas dessiné à l'écran (la passe d'ombres utilise son propre matériau).
  // (on lui donne alors un matériau minimal, qui n'écrit rien : en regardant ses pieds, le
  // corps couvrait une grande partie de l'écran, et chacun de ses pixels se calculait avec
  // toutes les lumières, les ombres et le brouillard pour rien)
  setFirstPerson(on) {
    if (this.firstPerson === on) return;
    this.firstPerson = on;
    this.model.traverse((o) => {
      // seulement le corps (pas l'objet tenu en main, dont le matériau est partagé)
      if (!o.isMesh || !o.userData.skin) return;
      if (on) {
        o.userData.lit ||= o.material;
        const m = o.userData.lit;
        // (couche extérieure à trous : l'ombre garde ses trous)
        o.userData.hidden ||= new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, map: m.alphaTest ? m.map : null, alphaTest: m.alphaTest });
        o.material = o.userData.hidden;
      } else if (o.userData.lit) o.material = o.userData.lit;
    });
  }

  spawn() {
    const s = this.world.findSpawn();
    const { x, z } = hexToWorld(s.q, s.r);
    this.pos.set(x, s.y, z);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.fly = false;
  }

  // Une partie solide de la colonne (q, r) se trouve-t-elle entre les hauteurs a et b ?
  // (une dalle n'occupe que la moitié de sa case)
  solidColumn(q, r, a, b) {
    for (let y = Math.floor(a); y < b; y++) {
      const id = this.world.getBlock(q, r, y);
      if (!SOLID[id]) continue;
      const [lo, hi] = blockBox(id);
      if (y + hi > a && y + lo < b) return true;
    }
    return false;
  }

  // Partie solide entre les hauteurs a et b qui touche le cercle du joueur (rayon `radius`) ?
  touches(a, b, radius) {
    const { q, r } = worldToHex(this.pos.x, this.pos.z);
    for (const [dq, dr] of CELLS) {
      const c = hexToWorld(q + dq, r + dr), dx = this.pos.x - c.x, dz = this.pos.z - c.z;
      for (let y = Math.floor(a); y < b; y++) {
        const id = this.world.getBlock(q + dq, r + dr, y);
        if (!SOLID[id]) continue;
        const [lo, hi] = blockBox(id);
        if (y + hi > a && y + lo < b && cellOverlap(id, dx, dz, radius, a - y, b - y)) return true;
      }
    }
    return false;
  }

  // Bloc solide contenant la hauteur y sous le cercle du joueur : [bas, haut] de sa partie
  // solide, ou null (le plus haut / le plus bas selon `top`)
  solidAt(y, radius, top) {
    const { q, r } = worldToHex(this.pos.x, this.pos.z);
    const ly = Math.floor(y);
    let best = null;
    for (const [dq, dr] of CELLS) {
      const id = this.world.getBlock(q + dq, r + dr, ly);
      if (!SOLID[id]) continue;
      const c = hexToWorld(q + dq, r + dr);
      const span = solidSpan(id, this.pos.x - c.x, this.pos.z - c.z, radius, y - ly);
      if (!span) continue;
      const v = top ? ly + span[1] : ly + span[0];
      if (best === null || (top ? v > best : v < best)) best = v;
    }
    return best;
  }

  // Un sol sous les pieds (à moins de 0,6 bloc) ?
  hasFloor() {
    return this.touches(this.pos.y - 0.6, this.pos.y - 1e-3, RADIUS - 0.05);
  }

  collides() {
    return this.touches(this.pos.y + 1e-4, this.pos.y + HEIGHT - 1e-4, RADIUS - 1e-3);
  }

  // Le joueur touche-t-il un bloc `id` (contre lui, dessous ou au-dessus) ? (ex. un cactus)
  touchesBlock(id) { // (id : un bloc, ou une fonction id -> vrai / faux)
    const test = typeof id === 'function' ? id : (b) => b === id;
    const { q, r } = worldToHex(this.pos.x, this.pos.z);
    const y0 = Math.floor(this.pos.y - 0.05), y1 = Math.floor(this.pos.y + HEIGHT);
    for (const [dq, dr] of CELLS) {
      const c = hexToWorld(q + dq, r + dr);
      if (!cellOverlap(0, this.pos.x - c.x, this.pos.z - c.z, RADIUS + 0.06)) continue;
      for (let y = y0; y <= y1; y++) if (test(this.world.getBlock(q + dq, r + dr, y))) return true;
    }
    return false;
  }

  // Le bloc id est-il juste sous les pieds du joueur ? (ex. un bloc de magma)
  standsOn(id) {
    const { q, r } = worldToHex(this.pos.x, this.pos.z);
    const y = Math.floor(this.pos.y - 0.05);
    for (const [dq, dr] of CELLS) {
      if (this.world.getBlock(q + dq, r + dr, y) !== id) continue;
      const c = hexToWorld(q + dq, r + dr);
      if (cellOverlap(id, this.pos.x - c.x, this.pos.z - c.z, RADIUS - 0.02)) return true;
    }
    return false;
  }

  // Le joueur occupe-t-il la case (q, r, y) ? (id : le bloc qu'on veut y poser, une dalle
  // verticale n'en prend que la moitié)
  occupies(q, r, y, id = 0) {
    if (y + 1 <= this.pos.y || y >= this.pos.y + HEIGHT) return false;
    const c = hexToWorld(q, r);
    return cellOverlap(id, this.pos.x - c.x, this.pos.z - c.z, RADIUS - 0.01);
  }

  pushOutXZ() {
    const y0 = this.pos.y + 1e-4, y1 = this.pos.y + HEIGHT - 1e-4;
    for (let it = 0; it < 8; it++) {
      let moved = false;
      const { q, r } = worldToHex(this.pos.x, this.pos.z);
      for (const [dq, dr] of CELLS) {
        const c = hexToWorld(q + dq, r + dr);
        for (let y = Math.floor(y0); y < y1; y++) {
          const id = this.world.getBlock(q + dq, r + dr, y);
          if (!SOLID[id]) continue;
          const [lo, hi] = blockBox(id);
          if (!(y + hi > y0 && y + lo < y1)) continue;
          const push = cellPush(id, this.pos.x - c.x, this.pos.z - c.z, RADIUS, y0 - y, y1 - y);
          if (push) { this.pos.x += push[0]; this.pos.z += push[1]; moved = true; }
          if (BLOCKS[id]?.vslab === undefined && BLOCKS[id]?.pod === undefined) break; // (un bloc plein : une poussée suffit)
        }
      }
      if (!moved) break;
    }
  }

  // Vertical : on ne teste que la couche où arrivent les pieds (en descendant) ou la
  // tête (en montant). Un léger contact avec un mur sur le côté ne peut donc plus
  // être pris pour un sol ou un plafond (c'était la cause du passage à travers le sol).
  moveY(dy) {
    if (dy === 0) return;
    this.pos.y += dy;
    const slack = RADIUS - 0.05;
    if (dy < 0) {
      // les pieds sont entrés dans une partie solide : on remonte sur son dessus
      const top = this.solidAt(this.pos.y, slack, true);
      if (top === null) return;
      this.pos.y = top;
      this.onGround = true;
      this.fly = false;
    } else {
      const bottom = this.solidAt(this.pos.y + HEIGHT, slack, false);
      if (bottom === null) return;
      this.pos.y = bottom - HEIGHT - 1e-3;
    }
    this.vel.y = 0;
  }

  // Horizontal : on avance puis on se dégage des murs. Si on reste coincé (coin
  // entre deux hexas), on essaie de glisser sur un seul axe, sinon on annule le pas.
  // Au sol, on monte tout seul une marche d'un demi-bloc (une dalle).
  moveXZ(dx, dz) {
    const ox = this.pos.x, oz = this.pos.z;
    // marche : le pas bute sur un obstacle bas, mais passe un demi-bloc plus haut
    if (this.onGround && !this.fly) {
      this.pos.x = ox + dx;
      this.pos.z = oz + dz;
      if (this.collides()) {
        const oy = this.pos.y;
        this.pos.y = oy + STEP_UP;
        if (!this.collides()) return;
        this.pos.y = oy;
      }
    }
    for (const [mx, mz] of [[dx, dz], [dx, 0], [0, dz]]) {
      this.pos.x = ox + mx;
      this.pos.z = oz + mz;
      this.pushOutXZ();
      if (!this.collides()) return;
    }
    this.pos.x = ox;
    this.pos.z = oz;
  }

  update(dt, input) {
    // Assis dans un Hexacart : c'est le chariot qui déplace le joueur
    if (this.riding) {
      this.onGround = false;
      this.inWater = this.headInWater = false;
      this.animate(dt);
      return;
    }
    // Direction voulue
    let fx = 0, fz = 0;
    if (input.forward) fz -= 1;
    if (input.back) fz += 1;
    if (input.left) fx -= 1;
    if (input.right) fx += 1;
    if (input.ax || input.az) { fx = input.ax; fz = input.az; } // (joystick tactile)
    const len = Math.hypot(fx, fz);
    if (len > (input.ax || input.az ? 1 : 0)) { fx /= len; fz /= len; }
    if (!input.forward) this.sprint = false;
    if (input.sprint && input.forward) this.sprint = true;
    // la faim : on court moins vite, puis plus du tout (sprintFactor, voir survival.js ; pas en vol)
    if (!this.fly && this.sprintFactor <= 0) this.sprint = false;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = fx * cos + fz * sin;
    const wz = -fx * sin + fz * cos;
    // Dans l'eau : le corps (à mi-hauteur) est dans un bloc d'eau
    const cell = worldToHex(this.pos.x, this.pos.z);
    const body = this.world.getBlock(cell.q, cell.r, Math.floor(this.pos.y + 0.6));
    this.inWater = isWater(body);
    this.inIceWater = isIceWater(body); // (on y gèle, voir main.js)
    this.headInWater = isWater(this.world.getBlock(cell.q, cell.r, Math.floor(this.pos.y + EYE)));
    const swim = this.inWater && !this.fly;

    // accroupi : Maj, au sol (en vol et dans l'eau, Maj fait descendre)
    this.sneak = !!input.down && !this.fly && !swim;
    if (this.sneak) this.sprint = false;
    let speed = this.fly ? (this.sprint ? FLY_SPRINT : FLY) : (this.sneak ? SNEAK : this.sprint ? WALK + (SPRINT - WALK) * this.sprintFactor : WALK);
    if (swim) speed *= 0.55;

    const accel = this.fly ? 10 : (swim ? 8 : (this.onGround ? 20 : 6));
    const k = Math.min(1, accel * dt);
    this.vel.x += (wx * speed - this.vel.x) * k;
    this.vel.z += (wz * speed - this.vel.z) * k;

    if (this.fly) {
      const ty = ((input.jump ? 1 : 0) - (input.down ? 1 : 0)) * 8;
      this.vel.y += (ty - this.vel.y) * Math.min(1, 10 * dt);
    } else if (swim) {
      // Nage : gravité faible et freinage ; Espace pour remonter, Maj pour plonger.
      // À la surface, Espace donne une petite impulsion pour sortir de l'eau sur la rive.
      this.vel.y -= 9 * dt;
      if (input.jump) this.vel.y += (this.headInWater ? 22 : 30) * dt;
      if (input.down) this.vel.y -= 12 * dt;
      this.vel.y *= Math.max(0, 1 - 2.5 * dt);
      this.vel.y = Math.max(-4, Math.min(this.headInWater ? 3.5 : 5.5, this.vel.y));
      // À la surface, contre un bord : un vrai saut pour remonter sur le bloc (sinon on
      // ne sort pas assez de l'eau pour franchir la rive)
      if (input.jump && !this.headInWater && this.touches(Math.floor(this.pos.y + 0.3), Math.floor(this.pos.y + 1.2) + 1, RADIUS + 0.12)) {
        this.vel.y = Math.max(this.vel.y, SWIM_OUT);
      }
    } else {
      this.vel.y = Math.max(-55, this.vel.y - GRAVITY * dt);
      if (input.jump && this.onGround) this.vel.y = JUMP;
    }

    // Petits pas pour une collision fiable
    const steps = Math.ceil(dt / 0.01);
    const sdt = dt / steps;
    this.onGround = false;
    for (let s = 0; s < steps; s++) {
      this.moveY(this.vel.y * sdt);
      const guard = this.sneak && this.onGround;
      const ox = this.pos.x, oz = this.pos.z;
      this.moveXZ(this.vel.x * sdt, this.vel.z * sdt);
      // accroupi au bord d'un bloc : on ne tombe pas (on glisse le long du bord si possible)
      if (guard && !this.hasFloor()) {
        const nx = this.pos.x, nz = this.pos.z;
        this.pos.x = nx; this.pos.z = oz;
        if (!this.hasFloor()) {
          this.pos.x = ox; this.pos.z = nz;
          if (!this.hasFloor()) { this.pos.x = ox; this.pos.z = oz; }
        }
        if (this.pos.x === ox) this.vel.x = 0;
        if (this.pos.z === oz) this.vel.z = 0;
      }
    }
    this.crouch += ((this.sneak ? 1 : 0) - this.crouch) * Math.min(1, dt * 14);

    if (this.pos.y < -DEPTH - 30) this.spawn(); // (tombé sous le monde)

    this.animate(dt);
  }

  animate(dt) {
    const m = this.model;
    m.position.copy(this.pos);
    m.rotation.y = this.yaw;
    if (!this.parts) return;
    if (this.riding) {
      // position assise : jambes à l'horizontale, bras vers l'avant
      const p = this.parts;
      p.legL.rotation.x = p.legR.rotation.x = 1.45;
      p.armL.rotation.x = p.armR.rotation.x = 0.5;
      p.head.rotation.x = this.pitch * 0.8;
      return;
    }
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.walkPhase += hs * dt * (this.sneak ? 4 : 2.2);
    const amp = this.fly ? 0.1 : Math.min(1, hs / (this.sneak ? SNEAK : WALK)) * (this.sneak ? 0.4 : 0.7);
    const sw = Math.sin(this.walkPhase) * amp;
    const p = this.parts;
    p.legL.rotation.x = sw;
    p.legR.rotation.x = -sw;
    p.armL.rotation.x = -sw;
    p.armR.rotation.x = sw;
    p.head.rotation.x = this.pitch * 0.8;
    crouchPose(p, this.crouch);
  }
}
