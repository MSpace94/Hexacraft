// Origine flottante : un monde vraiment sans bord.
// Le jeu garde ses positions dans le monde (nombres 64 bits : des blocs exacts jusqu'à 9 millions
// de milliards du centre). Mais la carte graphique calcule en 32 bits : à un million de blocs du
// centre, elle ne sait plus placer un sommet à mieux que 6 cm près, à 16 millions plus du tout
// (le terrain tremble, se fend, les ombres et l'eau se brisent). Three.js ne reçoit donc que des
// positions proches de zéro :
//  - le terrain est rangé par rapport au coin de chaque chunk (mesher.js) ; les autres objets
//    gardent leur position dans le monde ;
//  - la scène entière est décalée de -ORIGIN, un point fixe près du joueur : ce que la carte
//    graphique reçoit (matrices, sommets, lumières, ombres) reste petit et précis ;
//  - quand le joueur s'éloigne de plus de REBASE blocs, l'origine le rejoint par pas de STEP.
// Les shaders qui dessinent un motif selon la position (vagues, nuages, saisons) ajoutent
// uOrigin (l'origine modulo PERIOD) : leur motif reste le même d'une origine à l'autre.
import * as THREE from 'three';

export const STEP = 1024, REBASE = 1536, PERIOD = 8192;
export const ORIGIN = new THREE.Vector3();
export const uOrigin = { value: new THREE.Vector2() };
let scene = null;
const listeners = [];

// La scène décalée (celle du jeu ; les autres, comme l'objet tenu, restent telles quelles)
const inWorld = (o) => { while (o.parent) o = o.parent; return o === scene; };

export function initOrigin(sc, camera) {
  scene = sc;
  // (la caméra suit la scène : la vue reste la même, calculée en petits nombres)
  scene.add(camera);
  // Ce qui passe d'un objet au monde (et l'inverse) compte l'origine : le reste du jeu continue de
  // parler en positions du monde
  const P = THREE.Object3D.prototype;
  const l2w = P.localToWorld, w2l = P.worldToLocal, gwp = P.getWorldPosition, look = P.lookAt;
  P.localToWorld = function (v) { l2w.call(this, v); if (inWorld(this)) v.add(ORIGIN); return v; };
  P.worldToLocal = function (v) { if (inWorld(this)) v.sub(ORIGIN); return w2l.call(this, v); };
  P.getWorldPosition = function (v) { gwp.call(this, v); if (inWorld(this)) v.add(ORIGIN); return v; };
  P.lookAt = function (x, y, z) {
    if (!ORIGIN.x && !ORIGIN.z || !inWorld(this)) return look.call(this, x, y, z);
    const t = x.isVector3 ? x.clone() : new THREE.Vector3(x, y, z);
    return look.call(this, t.sub(ORIGIN));
  };
}

// Appelé quand l'origine change (ombres à refaire...)
export function onRebase(fn) { listeners.push(fn); }

// Place l'origine près de (x, z) ; force : tout de suite (un monde chargé, une téléportation)
export function followOrigin(x, z, force = false) {
  if (!scene) return false;
  if (!force && Math.abs(x - ORIGIN.x) < REBASE && Math.abs(z - ORIGIN.z) < REBASE) return false;
  const ox = Math.round(x / STEP) * STEP, oz = Math.round(z / STEP) * STEP;
  if (ox === ORIGIN.x && oz === ORIGIN.z) return false;
  ORIGIN.set(ox, 0, oz);
  scene.position.set(-ox, 0, -oz);
  scene.updateMatrixWorld(true);
  uOrigin.value.set(mod(ox, PERIOD), mod(oz, PERIOD));
  for (const fn of listeners) fn(ORIGIN);
  return true;
}

const mod = (a, n) => ((a % n) + n) % n;

// Une position du monde pour un shader (petite : par rapport à l'origine)
export const toScene = (v, out = new THREE.Vector3()) => out.set(v.x - ORIGIN.x, v.y, v.z - ORIGIN.z);
