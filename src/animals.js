// Animaux et villageois : cochon et moutons (régions tempérées), renard polaire et lièvre
// arctique (régions froides), villageois (dans les villages, voir villageInCell dans gen.js),
// et les zombies : ils sortent la nuit, poursuivent les joueurs en survie et les villageois,
// et brûlent au soleil (voir zombieTick et zombieThink).
//
// Modèles : uniquement des prismes hexagonaux (comme le personnage, voir character.js),
// habillés d'une texture au format des animaux de Minecraft (boîtes dépliées). Chaque espèce
// est décrite dans SPECIES : ses parties (taille, coin dans la texture, position, animation).
// Tous les animaux d'une espèce sont dessinés ensemble : un InstancedMesh par partie, soit
// quelques appels de dessin quel que soit leur nombre.
//
// Simulation (en solo et chez l'hôte en multijoueur) : gravité et collisions avec les
// hexagones du monde (comme le joueur, en plus petit), marche au hasard, saut d'une marche,
// évite les falaises, l'eau et la lave, flotte dans l'eau, s'enfuit quand on le frappe (le
// lièvre s'enfuit dès qu'on l'approche ; les villageois restent près de leur village).
// Seuls les animaux proches d'un joueur (distance d'affichage) bougent et sont dessinés ;
// les autres attendent, sauvegardés avec le monde.
//
// Apparition : peu à peu, en petits groupes, sur l'herbe des biomes tempérés ou sur la neige
// des régions froides, loin des yeux des joueurs (au plus NEAR_CAP autour de chacun). Les
// villageois apparaissent une fois par village, quand un joueur s'en approche.
import * as THREE from 'three';
import { hexPart } from './character.js?v=1.1.5-alpha-mvm2b95g';
import { SOLID, blockBox, blockOverlap, solidSpan, columnOverlap, columnPush, isWater, isLava, ITEMS, RAW_PORK, COOKED_PORK, WOOL_WHITE, WOOL_GREY, SNOW_GRASS, SNOW,
  RAW_MUTTON, COOKED_MUTTON, RAW_FOX, COOKED_FOX, isNaturalLeaves } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { worldToHex, hexToWorld, NEIGHBORS } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { BIOME } from './gen.js?v=1.1.5-alpha-mvm2b95g';
import { H, CS, idx, chunkKey, Y_MIN } from './mesher.js?v=1.1.5-alpha-mvm2b95g';
import { VillageTalk, packMemory, unpackMemory } from './villagetalk.js?v=1.1.5-alpha-mvm2b95g';
import { Colony, JOBS, JOB_KEYS } from './colony.js?v=1.1.5-alpha-mvm2b95g';
// Militaires (villageois recrutés par un joueur) : ils suivent le joueur le plus proche (ou
// gardent une position), combattent les monstres à SOLDIER_R, rejoignent le joueur s'il est
// trop loin, et guérissent avec le temps
const isSoldier = (a) => !!JOBS[a.job]?.recruit;
const _sv = new THREE.Vector3(); // (calculs : objet physique sous ses pieds)
const SOLDIER_R = 16, SOLDIER_HIT = 6, SOLDIER_EVERY = 0.75, SOLDIER_FAR = 40;

const TEMPERATE = new Set([BIOME.PLAINS, BIOME.FOREST, BIOME.BIG_FOREST, BIOME.EURO_FOREST]);
const GRASS = 1;
const GRAVITY = 30, JUMP = 8.6, STEP_UP = 0.51; // (saut : 1,2 bloc)
const TURN = 5;                   // rad/s
const CELLS = [[0, 0], ...NEIGHBORS];

const MAX_DRAWN = 256;            // animaux dessinés au plus par espèce (les plus proches)
const NEAR_CAP = 10;              // animaux sauvages autour d'un joueur, au plus (rayon SPAWN_R)
const SPAWN_R = 96, SPAWN_MIN = 32, SPAWN_EVERY = 2.5;
const MAX_TOTAL = 400;            // animaux sauvages dans tout le monde (les villageois ne comptent pas :
                                  // un village grandit sans limite, voir colony.js)
const ACTIVE_MARGIN = 8;          // simulés jusqu'à la distance d'affichage + cette marge
const VILLAGE_LOOK = 3;           // secondes entre deux recherches de village à peupler
const HOME_R = 14;                // les villageois restent à moins de HOME_R blocs du centre
const SHY_R = 6;                  // le lièvre s'enfuit si un joueur (debout) est plus près
// Zombies : la nuit, quelques-uns autour de chaque joueur (pas trop près, pas dans un village)
const ZOMBIE_CAP = 6, ZOMBIE_R = 64, ZOMBIE_MIN = 22, ZOMBIE_EVERY = 4, ZOMBIE_VILLAGE = 26;
const CHASE_R = 18, CHASE_PACE = 2.5;   // il repère sa proie à CHASE_R blocs, et court (x walk)
const BITE_R = 1.25, BITE = 3, BITE_EVERY = 1.1; // morsure : 3 points (un cœur et demi)
const SCARE_R = 10;               // un villageois s'enfuit devant un zombie plus près
// nuit (pour les zombies) : du coucher du soleil (0,5) jusqu'à peu avant l'aube
const isNight = (t) => t > 0.53 && t < 0.97;

// ---------- Espèces ----------
// Partie : g = { w, h, d, u, v, y0, grow, lie } (boîte de la texture, en pixels ; lie : couchée
// le long du corps, comme le corps du cochon), at : positions (pixels, z < 0 : devant),
// anim : 'head' (tourne la tête), 'legA' / 'legB' (pattes en diagonale), 'tail' (remue),
// 'arms' (bras croisés), ou rien ; head : partie fixée à la tête (oreilles, museau...) ;
// fur : couche de laine (deuxième texture).
const leg = (u, v, w, h, d, at, grow = 0) => ({ g: { w, h, d, u, v, y0: -h, grow }, at, anim: ['legA', 'legB', 'legB', 'legA'] });
export const SPECIES = {
  pig: {
    name: 'Cochon', skin: 'texture/entites/cochon/pig.png', tex: [64, 64], px: 1 / 16,
    health: 10, radius: 0.4, height: 0.9, walk: 1.2, panic: 3.4,
    headAt: [0, 12, -6],
    parts: [
      { g: { w: 10, h: 16, d: 8, u: 28, v: 8, y0: -8, lie: true }, at: [[0, 10.5, 0]] },
      // tête (8 x 8 x 8) devant le cou, et le groin (4 x 3 x 1) sur son devant
      { g: { w: 8, h: 8, d: 8, u: 0, v: 0, y0: -4, z: -4.5 }, at: [[0, 12, -6]], anim: 'head' },
      { g: { w: 4, h: 3, d: 1, u: 16, v: 16, y0: -3, z: -9.6 }, at: [[0, 12, -6]], anim: 'head' },
      leg(0, 16, 4, 6, 4, [[3, 6, -5], [-3, 6, -5], [3, 6, 5], [-3, 6, 5]]),
    ],
    hits: [[0, 0.62, 0.55], [0.72, 0.75, 0.36]],
    drop: (a) => [a.burnT > 0 ? COOKED_PORK : RAW_PORK, 1 + Math.floor(Math.random() * 3)],
  },
  sheep: {
    name: 'Mouton', skin: 'texture/entites/mouton/mouton.png', fur: 'texture/entites/mouton/laine.png', tex: [64, 32], px: 1 / 16,
    health: 8, radius: 0.45, height: 1.25, walk: 1.1, panic: 3.2,
    headAt: [0, 19, -8],
    parts: [
      { g: { w: 8, h: 16, d: 6, u: 28, v: 8, y0: -8, lie: true }, at: [[0, 15.5, 0]] },
      { g: { w: 6, h: 6, d: 8, u: 0, v: 0, y0: -3, z: -2 }, at: [[0, 19, -8]], anim: 'head' },
      leg(0, 16, 4, 12, 4, [[3, 12, -5], [-3, 12, -5], [3, 12, 7], [-3, 12, 7]]),
      // laine : corps, tête et haut des pattes, un peu plus gros
      { g: { w: 8, h: 16, d: 6, u: 28, v: 8, y0: -8, grow: 1.75, lie: true }, at: [[0, 15.5, 0]], fur: true },
      { g: { w: 6, h: 6, d: 6, u: 0, v: 0, y0: -3, z: -1, grow: 0.6 }, at: [[0, 19, -8]], anim: 'head', fur: true },
      { ...leg(0, 16, 4, 6, 4, [[3, 12, -5], [-3, 12, -5], [3, 12, 7], [-3, 12, 7]], 0.5), fur: true },
    ],
    hits: [[0, 0.95, 0.6], [0.6, 1.15, 0.38]],
    drop: () => [WOOL_WHITE, 1 + Math.floor(Math.random() * 2)],
    meat: (a) => [a.burnT > 0 ? COOKED_MUTTON : RAW_MUTTON, 1 + Math.floor(Math.random() * 2)],
  },
  fox: {
    name: 'Renard polaire', skin: 'texture/entites/renard/renard_polaire.png', tex: [48, 32], px: 1 / 16,
    health: 10, radius: 0.35, height: 0.7, walk: 1.6, panic: 4.5,
    headAt: [0, 6.5, -5],
    parts: [
      { g: { w: 6, h: 11, d: 6, u: 24, v: 15, y0: -5.5, lie: true }, at: [[0, 7.5, 3.5]] },
      { g: { w: 8, h: 6, d: 6, u: 1, v: 5, y0: -3 }, at: [[0, 6.5, -5]], anim: 'head' },
      // oreilles et museau, sur la tête
      { g: { w: 2, h: 2, d: 1, u: 8, v: 1, y0: 0, x: -3, z: -1.5 }, at: [[0, 9.5, -5]], anim: 'head' },
      { g: { w: 2, h: 2, d: 1, u: 15, v: 1, y0: 0, x: 3, z: -1.5 }, at: [[0, 9.5, -5]], anim: 'head' },
      { g: { w: 4, h: 2, d: 3, u: 6, v: 18, y0: -3, z: -4.5 }, at: [[0, 6.5, -5]], anim: 'head' },
      // queue touffue, couchée derrière
      { g: { w: 4, h: 9, d: 5, u: 30, v: 0, y0: 0, lie: true }, at: [[0, 8, 8]], anim: 'tail' },
      leg(4, 24, 2, 6, 2, [[2, 6, 0], [-2, 6, 0], [2, 6, 7], [-2, 6, 7]]),
    ],
    hits: [[0, 0.45, 0.42], [0.45, 0.45, 0.3]],
    drop: (a) => [a.burnT > 0 ? COOKED_FOX : RAW_FOX, 1 + Math.floor(Math.random() * 2)],
  },
  hare: {
    name: 'Lièvre arctique', skin: 'texture/entites/lievre/lievre_arctique.png', tex: [32, 32], px: 1 / 14,
    health: 6, radius: 0.3, height: 0.7, walk: 1.8, panic: 5.5, shy: true, hop: true,
    headAt: [0, 7, -3.4],
    parts: [
      { g: { w: 5, h: 4, d: 6, u: 0, v: 10, y0: -2 }, at: [[0, 4, 0.5]] },
      { g: { w: 3, h: 3, d: 6, u: 0, v: 20, y0: -1.5 }, at: [[2.6, 3.5, 1.4], [-2.6, 3.5, 1.4]] },
      { g: { w: 6, h: 5, d: 5, u: 0, v: 0, y0: -2 }, at: [[0, 7, -3.4]], anim: 'head' },
      // grandes oreilles debout et petit nez, sur la tête
      { g: { w: 2, h: 4, d: 1, u: 22, v: 8, y0: 0, x: 1.9, z: 0.6 }, at: [[0, 10, -3.4]], anim: 'head' },
      { g: { w: 2, h: 4, d: 1, u: 22, v: 8, y0: 0, x: -1.9, z: 0.6 }, at: [[0, 10, -3.4]], anim: 'head' },
      { g: { w: 2, h: 2, d: 2, u: 18, v: 20, y0: -1.5, z: -3 }, at: [[0, 7, -3.4]], anim: 'head' },
      leg(22, 0, 2, 2, 2, [[1.4, 2, -2.2], [-1.4, 2, -2.2]]),
      { ...leg(22, 4, 2, 2, 2, [[2.4, 2, 3.2], [-2.4, 2, 3.2]]), anim: ['legB', 'legA'] },
    ],
    hits: [[0, 0.4, 0.38], [0.35, 0.6, 0.26]],
    drop: () => null,
  },
  villager: {
    name: 'Villageois', skin: 'texture/entites/villageois/villageois.png', tex: [64, 64], px: 1 / 18,
    health: 20, radius: 0.26, height: 1.85, walk: 1, panic: 2.6, villager: true, // (rayon : comme le joueur, voir player.js — il passe les portes et les couloirs)
    headAt: [0, 24, 0],
    parts: [
      { g: { w: 8, h: 10, d: 8, u: 0, v: 0, y0: 0 }, at: [[0, 24, 0]], anim: 'head' },
      { g: { w: 8, h: 12, d: 6, u: 16, v: 20, y0: -12 }, at: [[0, 24, 0]] },
      // bras croisés devant lui
      { g: { w: 4, h: 8, d: 4, u: 44, v: 22, y0: -6 }, at: [[-6.2, 21, -1], [6.2, 21, -1]], anim: 'arms' },
      { g: { w: 8, h: 4, d: 4, u: 40, v: 38, y0: -6 }, at: [[0, 21, -1.5]], anim: 'arms' },
      { g: { w: 4, h: 12, d: 4, u: 0, v: 22, y0: -12 }, at: [[2.2, 12, 0], [-2.2, 12, 0]], anim: ['legA', 'legB'] },
    ],
    hits: [[0, 0.7, 0.4], [0, 1.55, 0.36]],
    drop: () => null,
  },
  villager_child: {
    name: 'Enfant villageois', skin: 'texture/entites/villageois/enfant.png', tex: [64, 64], px: 1 / 16,
    health: 10, radius: 0.25, height: 1.05, walk: 1.3, panic: 3, villager: true,
    headAt: [0, 8, 0],
    parts: [
      { g: { w: 8, h: 8, d: 7, u: 0, v: 0, y0: 0 }, at: [[0, 8, 0]], anim: 'head' },
      { g: { w: 4, h: 5, d: 3, u: 0, v: 15, y0: -5 }, at: [[0, 8, 0]] },
      { g: { w: 2, h: 4, d: 2, u: 16, v: 15, y0: -3 }, at: [[-3.6, 7.5, -0.6]], anim: 'arms' },
      { g: { w: 2, h: 4, d: 2, u: 36, v: 15, y0: -3 }, at: [[3.6, 7.5, -0.6]], anim: 'arms' },
      { g: { w: 4, h: 2, d: 2, u: 24, v: 17, y0: -3 }, at: [[0, 7, -1]], anim: 'arms' },
      { g: { w: 2, h: 3, d: 2, u: 0, v: 23, y0: -3 }, at: [[1.3, 3, 0]], anim: ['legA'] },
      { g: { w: 2, h: 3, d: 2, u: 8, v: 23, y0: -3 }, at: [[-1.3, 3, 0]], anim: ['legB'] },
    ],
    hits: [[0, 0.35, 0.3], [0, 0.75, 0.36]],
    drop: () => null,
  },
};
// Zombie : un personnage (skin au format des joueurs de Minecraft, 64 x 64), bras tendus devant
// lui ; la couche extérieure de la skin (cheveux, vêtements) par-dessus
const zLimb = (w, u, v, ou, ov, at, anim) => [
  { g: { w, h: 12, d: 4, u, v, y0: -12 }, at, anim },
  { g: { w, h: 12, d: 4, u: ou, v: ov, y0: -12, grow: 0.25 }, at, anim, fur: true },
];
const Z_ARM = 8 * 0.66 + 4 * 0.66, Z_LEG = 4 * 0.66;
SPECIES.zombie = {
  name: 'Zombie', skin: 'texture/entites/zombie/zombie.png', fur: 'texture/entites/zombie/zombie.png', tex: [64, 64], px: 1.8 / 32,
  health: 20, radius: 0.26, height: 1.85, walk: 1.1, panic: 2.6, hostile: true,
  headAt: [0, 24, 0],
  parts: [
    { g: { w: 8, h: 8, d: 8, u: 0, v: 0, y0: 0 }, at: [[0, 24, 0]], anim: 'head' },
    { g: { w: 8, h: 8, d: 8, u: 32, v: 0, y0: 0, grow: 0.5 }, at: [[0, 24, 0]], anim: 'head', fur: true },
    { g: { w: 8, h: 12, d: 4, u: 16, v: 16, y0: 0 }, at: [[0, 12, 0]] },
    { g: { w: 8, h: 12, d: 4, u: 16, v: 32, y0: 0, grow: 0.25 }, at: [[0, 12, 0]], fur: true },
    ...zLimb(4, 40, 16, 40, 32, [[Z_ARM, 24, 0]], 'arms'),
    ...zLimb(4, 32, 48, 48, 48, [[-Z_ARM, 24, 0]], 'arms'),
    ...zLimb(4, 0, 16, 0, 32, [[Z_LEG, 12, 0]], ['legA']),
    ...zLimb(4, 16, 48, 0, 48, [[-Z_LEG, 12, 0]], ['legB']),
  ],
  hits: [[0, 0.7, 0.4], [0, 1.55, 0.36]],
  drop: () => null,
};
// Vêtements d'un métier (texture au format des villageois de Minecraft, voir colony.js) :
// chapeau et robe un peu plus grands que la tête et le corps, et le bord du chapeau (s'il en a)
const JOB_PARTS = [
  { g: { w: 8, h: 10, d: 8, u: 32, v: 0, y0: 0, grow: 0.6 }, at: [[0, 24, 0]], anim: 'head' },
  { g: { w: 8, h: 20, d: 6, u: 0, v: 38, y0: -20, grow: 0.6 }, at: [[0, 24, 0]] },
  { g: { w: 16, h: 1, d: 16, u: 15, v: 48, y0: 0 }, at: [[0, 29, 0]], anim: 'head', brim: true },
];
// mouton gris : le même, avec sa laine grise
SPECIES.sheep_grey = {
  ...SPECIES.sheep, name: 'Mouton gris', skin: 'texture/entites/mouton/mouton_gris.png', fur: 'texture/entites/mouton/laine_grise.png',
  drop: () => [WOOL_GREY, 1 + Math.floor(Math.random() * 2)],
};
export const SPECIES_KEYS = Object.keys(SPECIES);
// ce qu'un animal peut laisser (vérifié à la réception en multijoueur)
export const DROP_IDS = new Set([RAW_PORK, COOKED_PORK, WOOL_WHITE, WOOL_GREY, RAW_MUTTON, COOKED_MUTTON, RAW_FOX, COOKED_FOX]);
// apparitions : région tempérée (herbe) ou froide (neige), et la part de chaque espèce
const WILD = {
  temperate: [['pig', 0.45], ['sheep', 0.4], ['sheep_grey', 0.15]],
  cold: [['fox', 0.45], ['hare', 0.55]],
};
const pick = (list) => { let x = Math.random(); for (const [k, p] of list) { x -= p; if (x < 0) return k; } return list[0][0]; };

const tmpM = new THREE.Matrix4(), tmpA = new THREE.Matrix4(), tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(1, 1, 1);
const WHITE = new THREE.Color(1, 1, 1), HURT = new THREE.Color(1, 0.4, 0.4);

// Géométrie d'une partie (prisme hexagonal habillé de la texture de l'espèce)
function partGeometry(g, sp) {
  const geo = hexPart({ w: g.w, h: g.h, d: g.d, u0: g.u, v0: g.v, y0: g.y0 ?? -g.h, grow: g.grow || 0, px: sp.px, tw: sp.tex[0], th: sp.tex[1] });
  if (g.lie) geo.rotateX(-Math.PI / 2);
  if (g.x || g.z) geo.translate((g.x || 0) * sp.px, 0, (g.z || 0) * sp.px);
  return geo;
}

function loadTexture(src) {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => {
      const tex = new THREE.Texture(i);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      res(tex);
    };
    i.onerror = () => res(null);
    i.src = src;
  });
}

// L'image a-t-elle des pixels visibles dans ce rectangle ?
function hasPixels(img, x, y, w, h) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(x, y, Math.min(w, img.width - x), Math.min(h, img.height - y)).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 128) return true;
  return false;
}

let nextId = 1;

export class AnimalSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];          // { id, type, pos, vel, yaw, hp, ... }
    this.remote = false;     // client en ligne : l'hôte simule, on ne fait qu'afficher
    this.spawnClock = 1;
    this.villageClock = 0;
    this.populated = new Set(); // villages déjà peuplés (leur clé)
    this.drawn = 0;
    this.onHurt = null;      // (animal) : un animal a été frappé (son, etc.)
    this.onBite = null;      // (joueur, dégâts, x, z) : un zombie mord un joueur (le jeu décide)
    this.canPrey = () => true; // (joueur) : un zombie peut-il le poursuivre ? (survie)
    this.zombieClock = 2;
    this.meshes = {};        // espèce -> [{ mesh, part, n }]
    this.talk = new VillageTalk(this, SPECIES); // langue et mémoire des villageois
    this.colony = new Colony(this, SPECIES);    // métiers, chantiers, croissance des villages
    this.jobMeshes = {};     // métier -> [{ mesh, part, n }] (vêtements)
  }

  async init() {
    await Promise.all(SPECIES_KEYS.map(async (key) => {
      const sp = SPECIES[key];
      const [skin, fur] = await Promise.all([loadTexture(sp.skin), sp.fur ? loadTexture(sp.fur) : null]);
      const mat = new THREE.MeshLambertMaterial(skin ? { map: skin } : { color: 0xd0c0b0 });
      const furMat = sp.fur ? new THREE.MeshLambertMaterial(fur ? { map: fur, alphaTest: 0.5 } : { color: 0xf0f0f0 }) : null;
      this.meshes[key] = sp.parts.map((part) => {
        const n = part.at.length;
        const m = new THREE.InstancedMesh(partGeometry(part.g, sp), part.fur ? furMat : mat, MAX_DRAWN * n);
        m.count = 0;
        m.frustumCulled = false; // (les instances sont partout : pas de sphère englobante)
        m.castShadow = true;
        m.receiveShadow = true;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < MAX_DRAWN * n; i++) m.setColorAt(i, WHITE);
        this.scene.add(m);
        return { mesh: m, part, n };
      });
    }));
    // vêtements des métiers (le bord du chapeau seulement s'il est dessiné)
    const sp = SPECIES.villager;
    await Promise.all(JOB_KEYS.map(async (job) => {
      const tex = await loadTexture('texture/entites/villageois/metiers/' + JOBS[job].skin + '.png');
      if (!tex) return;
      const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 });
      this.jobMeshes[job] = JOB_PARTS.filter((p) => !p.brim || hasPixels(tex.image, 31, 48, 32, 16)).map((part) => {
        const m = new THREE.InstancedMesh(partGeometry(part.g, sp), mat, MAX_DRAWN);
        m.count = 0;
        m.visible = false;
        m.frustumCulled = false;
        m.castShadow = true;
        m.receiveShadow = true;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < MAX_DRAWN; i++) m.setColorAt(i, WHITE);
        this.scene.add(m);
        return { mesh: m, part, n: 1 };
      });
    }));
  }

  clear() {
    this.list = [];
    this.remote = false;
    this.spawnClock = 1;
    this.populated.clear();
    this.talk.clear();
    this.colony.clear();
    this.draw([]);
  }

  // Nombre d'animaux par espèce (écran F3)
  counts() {
    const c = {};
    for (const a of this.list) c[a.type] = (c[a.type] || 0) + 1;
    return c;
  }

  // ---------- Sauvegarde ----------
  // [espèce, x, y, z, direction, vie] (+ villageois : centre du village x, z et graine), et
  // ['village', clé] pour chaque village déjà peuplé
  serialize() {
    const r = (v) => Math.round(v * 100) / 100;
    const out = this.list.filter((a) => !a.dead).map((a) => {
      const e = [a.type, r(a.pos.x), r(a.pos.y), r(a.pos.z), r(a.yaw), a.hp];
      if (a.home) e.push(r(a.home.x), r(a.home.z), a.seed);
      if (a.home) {
        e.push(packMemory(a.mem) || 0);
        // (métier, maison, ce qu'il porte, âge d'un enfant, village)
        const w = {};
        if (a.job) w.j = a.job;
        if (a.house) w.h = a.house;
        if (a.carry && Object.keys(a.carry).length) w.c = a.carry;
        if (a.age !== undefined) w.g = Math.round(a.age);
        if (a.vk) w.k = a.vk;
        if (a.mode === 'stay' && a.post) w.m = [r(a.post.x), r(a.post.y), r(a.post.z)];
        if (a.owner) w.o = a.owner;
        if (Object.keys(w).length) e.push(w);
      }
      return e;
    });
    for (const k of this.populated) out.push(['village', k]);
    out.push(['colony', this.colony.serialize()]);
    return out;
  }

  load(list) {
    this.list = [];
    this.populated.clear();
    if (!Array.isArray(list)) return;
    for (const e of list) {
      if (!Array.isArray(e)) continue;
      if (e[0] === 'village') { if (typeof e[1] === 'string') this.populated.add(e[1]); continue; }
      if (e[0] === 'colony') { this.colony.load(e[1]); continue; }
      if (!SPECIES[e[0]] || !e.slice(1, 6).every(Number.isFinite)) continue;
      if (!SPECIES[e[0]].villager && !SPECIES[e[0]].hostile && this.wild() >= MAX_TOTAL) continue;
      const a = this.add(e[0], e[1], e[2], e[3], e[4]);
      a.hp = Math.max(1, Math.min(SPECIES[e[0]].health, e[5]));
      if (SPECIES[e[0]].villager && Number.isFinite(e[6]) && Number.isFinite(e[7])) {
        a.home = { x: e[6], z: e[7] };
        if (Number.isInteger(e[8])) a.seed = e[8];
        a.mem = unpackMemory(e[9]);
        const w = e[10];
        if (w && typeof w === 'object') {
          if (JOBS[w.j]) a.job = w.j;
          if (typeof w.h === 'string') a.house = w.h;
          if (typeof w.k === 'string') a.vk = w.k;
          if (isSoldier(a)) { a.vk = null; a.mode = 'follow'; if (typeof w.o === 'string') a.owner = w.o.slice(0, 32); }
          if (isSoldier(a) && Array.isArray(w.m) && w.m.length === 3 && w.m.every(Number.isFinite)) { a.mode = 'stay'; a.post = { x: w.m[0], y: w.m[1], z: w.m[2] }; }
          if (Number.isFinite(w.g)) a.age = w.g;
          if (w.c && typeof w.c === 'object') {
            a.carry = {};
            for (const k in w.c) if (Number.isInteger(+k) && Number.isInteger(w.c[k]) && w.c[k] > 0) a.carry[k] = Math.min(w.c[k], 256);
          }
        }
      }
    }
  }

  add(type, x, y, z, yaw = Math.random() * Math.PI * 2, id = nextId++) {
    const a = {
      id, type, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), yaw, hp: SPECIES[type].health,
      onGround: false, fallFrom: y, state: 'idle', timer: Math.random() * 3, target: null,
      headYaw: 0, headTarget: 0, walk: 0, phase: Math.random() * 6, hurtT: 0, inv: 0,
      dead: false, deadT: 0, burnT: 0, stuck: 0, active: true,
      seed: Math.floor(Math.random() * 1e9), home: null,
      // (client : position reçue de l'hôte, rejointe en douceur)
      to: new THREE.Vector3(x, y, z), toYaw: yaw,
    };
    if (SPECIES[type].villager) a.home = { x, z };
    this.list.push(a);
    return a;
  }

  // Un animal (ou un villageois) marche-t-il à moins de R blocs de p ? (ses ombres bougent)
  movingNear(p, R) {
    for (const a of this.list) if (a.active && (a.walk > 0.05 || a.hurtT > 0 || (a.dead && a.deadT < 1)) && Math.abs(a.pos.x - p.x) < R && Math.abs(a.pos.z - p.z) < R) return true;
    return false;
  }

  // Animaux sauvages (pas les villageois)
  wild() {
    let n = 0;
    for (const a of this.list) if (!SPECIES[a.type].villager && !SPECIES[a.type].hostile) n++;
    return n;
  }

  byId(id) {
    return this.list.find((a) => a.id === id) || null;
  }

  // Œuf d'apparition : un animal de cette espèce en (x, y, z)
  spawnAt(type, x, y, z) {
    if (!SPECIES[type] || (!SPECIES[type].villager && !SPECIES[type].hostile && this.wild() >= MAX_TOTAL)) return null;
    return this.add(type, x, y, z);
  }

  // Lecture rapide d'un bloc : le dernier chunk lu reste sous la main (pas de clé à fabriquer à
  // chaque lecture ; les collisions en font des centaines par image)
  blk(q, r, y) {
    if (y < Y_MIN) return 4;
    if (y >= H) return 0;
    const cq = Math.floor(q / CS), cr = Math.floor(r / CS);
    if (cq !== this.bq || cr !== this.br) {
      this.bq = cq; this.br = cr;
      this.bd = this.world.chunks?.get(chunkKey(cq, cr))?.data || null;
    }
    return this.bd ? this.bd[idx(q - cq * CS, r - cr * CS, y)] : this.world.getBlock(q, r, y);
  }

  // ---------- Collisions avec le monde (comme le joueur, voir player.js) ----------
  solidColumn(q, r, a, b) {
    for (let y = Math.floor(a); y < b; y++) {
      const id = this.blk(q, r, y);
      if (!SOLID[id]) continue;
      const [lo, hi] = blockBox(id);
      if (y + hi > a && y + lo < b) return true;
    }
    return false;
  }

  // (dalles verticales : seulement leur moitié, voir blocks.js)
  touches(a, y0, y1, rad) {
    const { q, r } = worldToHex(a.pos.x, a.pos.z), get = this.getter();
    for (const [dq, dr] of CELLS) {
      const c = hexToWorld(q + dq, r + dr);
      if (columnOverlap(get, q + dq, r + dr, y0, y1, a.pos.x - c.x, a.pos.z - c.z, rad)) return true;
    }
    return false;
  }

  getter() {
    return (this._get ||= (q, r, y) => this.blk(q, r, y));
  }

  collides(a) {
    const sp = SPECIES[a.type];
    return this.touches(a, a.pos.y + 1e-4, a.pos.y + sp.height - 1e-4, sp.radius - 1e-3);
  }

  solidAt(a, y, rad, top) {
    const { q, r } = worldToHex(a.pos.x, a.pos.z);
    const ly = Math.floor(y);
    let best = null;
    for (const [dq, dr] of CELLS) {
      const id = this.blk(q + dq, r + dr, ly);
      if (!SOLID[id]) continue;
      const c = hexToWorld(q + dq, r + dr);
      const span = solidSpan(id, a.pos.x - c.x, a.pos.z - c.z, rad, y - ly);
      if (!span) continue;
      const v = top ? ly + span[1] : ly + span[0];
      if (best === null || (top ? v > best : v < best)) best = v;
    }
    return best;
  }

  moveY(a, dy) {
    if (dy === 0) return;
    const sp = SPECIES[a.type];
    a.pos.y += dy;
    const slack = sp.radius - 0.05;
    if (dy < 0) {
      const top = this.solidAt(a, a.pos.y, slack, true);
      if (top === null) return;
      a.pos.y = top;
      a.onGround = true;
    } else {
      const bottom = this.solidAt(a, a.pos.y + sp.height, slack, false);
      if (bottom === null) return;
      a.pos.y = bottom - sp.height - 1e-3;
    }
    a.vel.y = 0;
  }

  pushOut(a) {
    const sp = SPECIES[a.type];
    const y0 = a.pos.y + 1e-4, y1 = a.pos.y + sp.height - 1e-4;
    for (let it = 0; it < 6; it++) {
      let moved = false;
      const { q, r } = worldToHex(a.pos.x, a.pos.z);
      for (const [dq, dr] of CELLS) {
        const c = hexToWorld(q + dq, r + dr);
        const push = columnPush(this.getter(), q + dq, r + dr, y0, y1, a.pos.x - c.x, a.pos.z - c.z, sp.radius);
        if (push) { a.pos.x += push[0]; a.pos.z += push[1]; moved = true; }
      }
      if (!moved) break;
    }
  }

  // Avance de (dx, dz) ; renvoie vrai si un mur a arrêté le pas
  moveXZ(a, dx, dz) {
    const ox = a.pos.x, oz = a.pos.z;
    if (a.onGround) {
      a.pos.x = ox + dx; a.pos.z = oz + dz;
      if (this.collides(a)) {
        const oy = a.pos.y;
        a.pos.y = oy + STEP_UP;
        if (!this.collides(a)) return false;
        a.pos.y = oy;
      }
    }
    for (const [mx, mz] of [[dx, dz], [dx, 0], [0, dz]]) {
      a.pos.x = ox + mx; a.pos.z = oz + mz;
      this.pushOut(a);
      // (repoussé presque jusqu'au départ par un mur : c'est aussi un pas bloqué)
      if (!this.collides(a)) return mx !== dx || mz !== dz || (a.pos.x - ox) * dx + (a.pos.z - oz) * dz < (dx * dx + dz * dz) * 0.3;
    }
    a.pos.x = ox; a.pos.z = oz;
    return true;
  }

  // Sol sous le point (x, z) en partant de la hauteur y (jusqu'à `depth` blocs plus bas) :
  // { y : dessus du sol, id : bloc dessous } ou null. Sert à éviter falaises, eau et lave.
  groundAhead(x, z, y, depth) {
    const { q, r } = worldToHex(x, z);
    for (let yy = Math.floor(y + 0.5); yy >= Math.floor(y) - depth; yy--) {
      const id = this.blk(q, r, yy);
      if (isWater(id) || isLava(id)) return { y: yy + 1, id };
      if (SOLID[id]) return { y: yy + 1, id };
    }
    return null;
  }

  // ---------- Coups ----------
  // Frappé par un coup de `dmg` points venant de (fx, fz). Renvoie ce qu'il laisse s'il meurt
  // ([objet, nombre]) ou null.
  // (by : pseudo du joueur qui frappe, s'il y en a un : les villageois s'en souviennent)
  hit(a, dmg, fx, fz, by = null) {
    if (!a || a.dead || a.inv > 0) return null;
    a.hp -= dmg;
    a.hurtT = 0.4;
    a.inv = 0.45;
    let dx = a.pos.x - fx, dz = a.pos.z - fz;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    a.vel.x = dx * 5; a.vel.z = dz * 5; a.vel.y = 5.5;
    a.onGround = false;
    // il s'enfuit à toutes pattes, droit devant lui (à l'opposé du coup) ; un zombie, lui, revient
    if (!SPECIES[a.type].hostile && a.job !== 'guard' && !isSoldier(a)) this.flee(a, dx, dz, 5);
    this.onHurt?.(a);
    if (a.hp > 0) { this.talk.hurt(a, by); return null; }
    a.dead = true;
    a.deadT = 0;
    this.talk.hurt(a, by);
    // (le mouton laisse aussi sa viande : renvoyée à part, voir meatOf)
    a.meat = SPECIES[a.type].meat?.(a) || null;
    return SPECIES[a.type].drop(a);
  }

  flee(a, dx, dz, time) {
    a.state = 'panic';
    a.timer = time;
    a.target = { x: a.pos.x + dx * 14, z: a.pos.z + dz * 14 };
  }

  // Explosion en (x, y, z) de rayon R : blesse et projette les animaux proches
  explode(x, y, z, R) {
    if (this.remote) return;
    for (const a of this.list) {
      const d = Math.hypot(a.pos.x - x, a.pos.y + 0.5 - y, a.pos.z - z);
      if (d >= R || a.dead) continue;
      a.inv = 0;
      this.hit(a, Math.ceil((1 - d / R) * 14), x, z);
      a.vel.y += (1 - d / R) * 8;
    }
  }

  // Rayon (origine o, direction d unitaire) : l'animal touché le plus proche { animal, t }
  raycast(o, d, reach) {
    let best = null;
    for (const a of this.list) {
      if (a.dead || !a.active) continue;
      const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
      // quelques sphères : le corps et la tête
      for (const [off, up, rad] of SPECIES[a.type].hits) {
        const cx = a.pos.x + fx * off, cy = a.pos.y + up, cz = a.pos.z + fz * off;
        const lx = cx - o.x, ly = cy - o.y, lz = cz - o.z;
        const tc = lx * d.x + ly * d.y + lz * d.z;
        if (tc < 0) continue;
        const d2 = lx * lx + ly * ly + lz * lz - tc * tc;
        if (d2 > rad * rad) continue;
        const t = tc - Math.sqrt(rad * rad - d2);
        if (t <= reach && (!best || t < best.t)) best = { animal: a, t };
      }
    }
    return best;
  }

  // ---------- Simulation ----------
  // ctx : { players: [{ pos, sneak }], view }
  update(dt, ctx) {
    this.bq = this.br = NaN; // (les chunks ont pu être rechargés)
    const players = ctx.players;
    this.players = players;
    const range = ctx.view + ACTIVE_MARGIN;
    for (const a of this.list) {
      let near = false;
      for (const p of players) if (Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z) < range) { near = true; break; }
      a.active = near;
    }
    if (this.remote) {
      for (const a of this.list) this.follow(a, dt);
    } else {
      for (const a of this.list) if (a.active) this.step(a, dt, players);
      this.list = this.list.filter((a) => !(a.dead && a.deadT > 1));
      this.spawnTick(dt, players, ctx.view);
      this.zombieTick(dt, players, ctx.view);
      this.villageTick(dt, players);
      this.colony.tick(dt, this.list, players);
      this.talk.tick(dt, players);
    }
    this.draw(players, dt);
  }

  // Client : rejoint la position envoyée par l'hôte
  follow(a, dt) {
    const k = 1 - Math.exp(-dt * 12);
    const moved = Math.hypot(a.to.x - a.pos.x, a.to.z - a.pos.z);
    a.pos.lerp(a.to, k);
    let dy = a.toYaw - a.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    a.yaw += dy * k;
    a.walk = Math.min(1, moved / Math.max(dt, 1e-3) / SPECIES[a.type].walk * 0.6);
    a.phase += dt * 9 * a.walk;
    if (a.hurtT > 0) a.hurtT -= dt;
    if (a.dead) a.deadT += dt;
    if (a.work > 0) a.wphase = (a.wphase || 0) + dt * 9;
  }

  step(a, dt, players) {
    const sp = SPECIES[a.type];
    // voyageur assis dans un wagon passagers : le train le place (voir trains.seatRiders)
    if (a.riding) {
      if (a.dead || !a.riding.owner?.cars.includes(a.riding)) { a.riding = null; }
      else {
        a.vel.set(0, 0, 0);
        a.onGround = true;
        a.fallFrom = a.pos.y;
        a.walk = 0;
        a.target = null;
        a.state = 'idle';
        a.yaw = Math.atan2(-a.riding.dir.x, -a.riding.dir.z);
        return;
      }
    }
    // assis dans un véhicule (le chauffeur de taxi) : emporté avec lui
    if (a.seat) {
      const S = this.structs, s = a.seat.s;
      if (!S || !S.list.includes(s) || a.dead) a.seat = null;
      else {
        S.toWorld(s, a.seat.L, a.pos);
        a.vel.set(0, 0, 0);
        a.onGround = true;
        a.fallFrom = a.pos.y;
        a.walk = 0;
        this.think(a, dt);
        a.target = null;
        return;
      }
    }
    if (a.hurtT > 0) a.hurtT -= dt;
    if (a.inv > 0) a.inv -= dt;
    if (a.burnT > 0) a.burnT -= dt;
    if (a.zSaid > 0) a.zSaid -= dt; // (villageois : a crié en voyant un zombie)
    // debout sur un objet physique : il bouge (et tourne) avec lui
    if (a.onStruct) {
      const s = a.onStruct.s;
      if (this.structs?.list.includes(s)) { const w = this.structs.toWorld(s, a.onStruct.L, _sv); a.pos.x += w.x - a.onStruct.w.x; a.pos.y += w.y - a.onStruct.w.y; a.pos.z += w.z - a.onStruct.w.z; }
      a.onStruct = null;
    }
    const cell = worldToHex(a.pos.x, a.pos.z);
    const feet = this.blk(cell.q, cell.r, Math.floor(a.pos.y + 0.1));
    const inWater = isWater(feet), inLava = isLava(feet);

    if (a.dead) {
      a.deadT += dt;
    } else {
      // lave : il brûle (et le cochon cuit...)
      if (inLava) { a.burnT = 3; if (a.inv <= 0) this.hit(a, 4, a.pos.x - a.vel.x, a.pos.z - a.vel.z); }
      // le lièvre détale dès qu'un joueur debout approche
      if (sp.shy && a.state !== 'panic') {
        for (const p of players) {
          const dx = a.pos.x - p.pos.x, dz = a.pos.z - p.pos.z, d = Math.hypot(dx, dz);
          if (d < SHY_R && !p.sneak && Math.abs(p.pos.y - a.pos.y) < 4) { this.flee(a, dx / (d || 1), dz / (d || 1), 3); break; }
        }
      }
      if (sp.hostile) this.zombieThink(a, dt, players); else this.think(a, dt);
    }

    // déplacement voulu
    let speed = 0;
    if (!a.dead && a.target && (a.state === 'walk' || a.state === 'panic')) {
      const dx = a.target.x - a.pos.x, dz = a.target.z - a.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.4) { a.state = 'idle'; a.timer = 1 + Math.random() * 4; a.target = null; } else {
        // se tourne vers la cible, puis avance dans la direction où il regarde
        const want = Math.atan2(-dx, -dz);
        let d = want - a.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        a.yaw += Math.max(-TURN * dt, Math.min(TURN * dt, d));
        speed = (a.state === 'panic' ? sp.panic : sp.walk * (a.pace || 1)) * Math.max(0, Math.cos(d));
        if (speed > 0) {
          const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
          // falaise, eau ou lave droit devant : il s'arrête (sauf l'eau quand il panique)
          const g = this.groundAhead(a.pos.x + fx * 0.8, a.pos.z + fz * 0.8, a.pos.y + 1, 4);
          const bad = !g || isLava(g.id) || (isWater(g.id) && a.state !== 'panic' && !inWater && !a.prey) || g.y < a.pos.y - 3;
          if (bad && a.onGround) { a.state = 'idle'; a.timer = 0.5 + Math.random() * 2; a.target = null; speed = 0; }
        }
      }
    }
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
    // vitesse horizontale : la marche, plus l'élan d'un coup reçu (freiné au sol)
    const fric = a.onGround ? Math.exp(-dt * 8) : Math.exp(-dt * 1.5);
    a.vel.x *= fric; a.vel.z *= fric;
    // (élan presque éteint : arrêté net, pour ne plus calculer de collisions pour rien)
    if (Math.abs(a.vel.x) < 0.02) a.vel.x = 0;
    if (Math.abs(a.vel.z) < 0.02) a.vel.z = 0;
    const mx = (fx * speed + a.vel.x) * dt, mz = (fz * speed + a.vel.z) * dt;
    const blocked = (mx || mz) ? this.moveXZ(a, mx, mz) : false;
    // bute sur une marche : il saute (une seule marche) ; coincé trop longtemps : autre chemin
    if (blocked && speed > 0) {
      a.stuck += dt;
      // (compensé pour la gravité appliquée avant le pas : même saut quel que soit dt)
      if (a.onGround) { a.vel.y = JUMP + GRAVITY * dt * 0.5; a.onGround = false; }
      if (a.stuck > 1.2) { a.stuck = 0; a.state = 'idle'; a.timer = 0.3; a.target = null; }
    } else a.stuck = Math.max(0, a.stuck - dt);

    // vertical : gravité, flotte dans l'eau. Au repos sur le sol (ni pas ni élan), on ne
    // revérifie le sol que deux fois par seconde (un bloc cassé dessous : il tombe)
    const resting = a.onGround && !inWater && !mx && !mz && a.vel.y <= 0;
    if (resting && (a.restT = (a.restT || 0) - dt) > 0) {
      a.vel.y = 0;
    } else {
      if (resting) a.restT = 0.5;
      if (inWater) {
        a.vel.y = Math.min(2.2, a.vel.y + 30 * dt);
        a.vel.y *= Math.exp(-dt * 2);
      } else a.vel.y -= GRAVITY * dt;
      const wasGround = a.onGround;
      a.onGround = false;
      this.moveY(a, a.vel.y * dt);
      if (!a.onGround && wasGround && a.vel.y <= 0) {
        // descend une petite marche sans "tomber"
        const below = this.solidAt(a, a.pos.y - 0.55, sp.radius - 0.05, true);
        if (below !== null) { a.pos.y = below; a.onGround = true; a.vel.y = 0; }
      }
    }
    // les objets physiques : il se pose dessus, ne les traverse pas
    if (this.structs?.list.length) {
      const s = this.structs.collideMob(a, sp.radius, sp.height);
      if (s) a.onStruct = { s, L: this.structs.toLocal(s, a.pos, new a.pos.constructor()), w: a.pos.clone() };
      // il bute contre un bloc d'un objet en marchant : il saute dessus (comme une marche du monde)
      if (a.bumpStruct && speed > 0 && a.onGround) { a.vel.y = JUMP + GRAVITY * dt * 0.5; a.onGround = false; }
    }
    // chutes : 1 point par bloc au-delà de 3 (pas dans l'eau)
    if (a.onGround || inWater) {
      const fall = a.fallFrom - a.pos.y;
      if (a.onGround && !inWater && fall > 3.5 && !a.dead) this.hit(a, Math.floor(fall - 3), a.pos.x, a.pos.z);
      a.fallFrom = a.pos.y;
    } else if (a.pos.y > a.fallFrom) a.fallFrom = a.pos.y;
    if (a.pos.y < Y_MIN - 20) { a.dead = true; a.deadT = 2; }

    // les joueurs le bousculent, les animaux s'écartent les uns des autres
    for (const p of players) this.shove(a, p.pos, 0.3 + sp.radius, 1.8);
    for (const b of this.list) if (b !== a && b.active && !b.dead) this.shove(a, b.pos, sp.radius + SPECIES[b.type].radius, SPECIES[b.type].height);

    // animation
    a.walk += ((speed > 0.1 ? Math.min(1, speed / sp.walk * 0.7) : 0) - a.walk) * Math.min(1, dt * 8);
    a.phase += dt * (speed > 0 ? 4 + speed * 2.5 : 0);
    if (a.work > 0) a.wphase = (a.wphase || 0) + dt * 9;
    const hd = a.headTarget - a.headYaw;
    a.headYaw += hd * Math.min(1, dt * 4);
  }

  shove(a, p, dist, h) {
    if (p.y > a.pos.y + SPECIES[a.type].height || p.y + h < a.pos.y) return;
    const dx = a.pos.x - p.x, dz = a.pos.z - p.z, d = Math.hypot(dx, dz);
    if (d >= dist || d < 1e-4) return;
    const k = (dist - d) * 0.5;
    this.moveXZ(a, (dx / d) * k, (dz / d) * k);
  }

  // Comportement : se promener, s'arrêter, regarder autour de lui (un villageois reste près
  // de son village)
  // Recrute le villageois a comme militaire (job : 'soldier' ou 'soldier2', la tenue)
  recruit(a, job, owner = null) {
    if (!a || a.dead || a.type !== 'villager' || !JOBS[job]?.recruit) return false;
    a.owner = owner;
    a.task = null;
    a.vk = null;
    a.house = null;
    a.carry = {};
    a.job = job;
    a.mode = 'follow';
    a.post = null;
    a.state = 'idle';
    a.target = null;
    this.talk.say(a, 'salute');
    return true;
  }
  // Ordre d'un joueur à son militaire : 'follow' (suis-moi), 'stay' (garde cette position),
  // 'civil' (rendu à la vie civile : il retourne au village le plus proche)
  command(a, order) {
    if (!a || a.dead || !isSoldier(a)) return;
    if (order === 'civil') { a.job = null; a.mode = undefined; a.post = null; a.vk = undefined; this.talk.say(a, 'thanks'); return; }
    a.mode = order === 'stay' ? 'stay' : 'follow';
    a.post = a.mode === 'stay' ? { x: a.pos.x, y: a.pos.y, z: a.pos.z } : null;
    this.talk.say(a, 'salute');
  }
  soldierThink(a, dt) {
    const sp = SPECIES[a.type];
    if ((a.healT = (a.healT || 0) - dt) <= 0) { a.healT = 4; a.hp = Math.min(sp.health, a.hp + 1); }
    // son chef : le joueur le plus proche ; ce qu'il protège : son chef, ou son poste
    // (son chef : celui qui l'a recruté, s'il est là ; sinon le joueur le plus proche)
    let boss = (a.owner && (this.players || []).find((p) => p.pseudo === a.owner)) || null, bd = Infinity;
    if (!boss) for (const p of this.players || []) { const d = Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z); if (d < bd) { bd = d; boss = p; } }
    const base = a.mode === 'stay' && a.post ? a.post : boss?.pos;
    // un monstre près de lui ou de ce qu'il protège (cherché quelques fois par seconde)
    if ((a.scanT = (a.scanT || 0) - dt) <= 0) {
      a.scanT = 0.3;
      a.foe = null;
      let fd = SOLDIER_R;
      for (const z of this.list) {
        if (z.dead || !z.active || !SPECIES[z.type].hostile || Math.abs(z.pos.y - a.pos.y) > 5) continue;
        const d = Math.hypot(z.pos.x - a.pos.x, z.pos.z - a.pos.z);
        if (d < fd && (!base || Math.hypot(z.pos.x - base.x, z.pos.z - base.z) < SOLDIER_R * 1.5)) { fd = d; a.foe = z; }
      }
    }
    const z = a.foe;
    if (z && !z.dead && z.active) {
      const d = Math.hypot(z.pos.x - a.pos.x, z.pos.z - a.pos.z);
      if (d > 1.5) { a.state = 'walk'; a.pace = 1.9; a.target = { x: z.pos.x, z: z.pos.z }; a.timer = 999; return; }
      a.state = 'idle';
      a.target = null;
      a.yaw = Math.atan2(-(z.pos.x - a.pos.x), -(z.pos.z - a.pos.z));
      a.work = 0.3;
      if ((a.atkT = (a.atkT || 0) - dt) > 0) return;
      a.atkT = SOLDIER_EVERY;
      this.hit(z, SOLDIER_HIT, a.pos.x, a.pos.z);
      if (z.dead) { a.foe = null; if (Math.random() < 0.5) this.talk.say(a, 'done'); }
      return;
    }
    a.foe = null;
    if (!base) { a.state = 'idle'; a.target = null; return; }
    const d = Math.hypot(base.x - a.pos.x, base.z - a.pos.z);
    // le joueur est parti loin (à pied) : il le rejoint d'un coup
    if (a.mode !== 'stay' && boss && d > SOLDIER_FAR && boss.onGround !== false && !boss.fly) {
      a.pos.set(boss.pos.x, boss.pos.y + 0.05, boss.pos.z);
      a.vel.set(0, 0, 0);
      a.fallFrom = a.pos.y;
      return;
    }
    if (d > (a.mode === 'stay' ? 1 : 3.5)) {
      a.state = 'walk';
      a.pace = d > 8 ? 1.8 : 1.15;
      a.target = { x: base.x, z: base.z };
      a.timer = 999;
      return;
    }
    if (a.state === 'walk') { a.state = 'idle'; a.target = null; }
    if (boss && Math.random() < dt) a.headTarget = 0;
  }

  think(a, dt) {
    a.timer -= dt;
    if (a.state === 'panic') {
      if (a.timer <= 0) { a.state = 'idle'; a.timer = 2; a.target = null; } else if (!a.target || Math.random() < dt * 0.8) {
        // court dans tous les sens
        const ang = a.yaw + (Math.random() - 0.5) * 2;
        a.target = { x: a.pos.x - Math.sin(ang) * 10, z: a.pos.z - Math.cos(ang) * 10 };
      }
      return;
    }
    if (isSoldier(a)) { this.soldierThink(a, dt); return; }
    // voyageur : il va à la gare et attend le train (voir main.js, travelThink)
    if (a.travel && this.travelThink?.(a, dt)) return;
    // villageois d'un village : son métier, ses chantiers (voir colony.js)
    if (SPECIES[a.type].villager && this.colony.think(a, dt)) return;
    if (a.timer > 0) {
      if (a.state === 'idle' && Math.random() < dt * 0.5) a.headTarget = (Math.random() - 0.5) * 1.4;
      return;
    }
    if (Math.random() < 0.55) {
      const ang = Math.random() * Math.PI * 2, d = 2 + Math.random() * 6;
      let tx = a.pos.x + Math.cos(ang) * d, tz = a.pos.z + Math.sin(ang) * d;
      // trop loin de chez lui : il revient vers le centre du village
      if (a.home && Math.hypot(tx - a.home.x, tz - a.home.z) > HOME_R) {
        tx = a.home.x + (Math.random() - 0.5) * 8; tz = a.home.z + (Math.random() - 0.5) * 8;
      }
      a.target = { x: tx, z: tz };
      a.state = 'walk';
      a.timer = 8;
      a.headTarget = 0;
    } else {
      a.state = 'idle';
      a.target = null;
      a.timer = 2 + Math.random() * 5;
    }
  }

  // ---------- Apparition ----------
  spawnTick(dt, players, view) {
    this.spawnClock -= dt;
    if (this.spawnClock > 0 || !players.length || this.noSpawn) return; // (noSpawn : la station du tutoriel)
    this.spawnClock = SPAWN_EVERY;
    if (this.wild() >= MAX_TOTAL) return;
    const p = players[Math.floor(Math.random() * players.length)];
    let n = 0;
    for (const a of this.list) if (!SPECIES[a.type].villager && !SPECIES[a.type].hostile && Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) < SPAWN_R) n++;
    if (n >= NEAR_CAP) return;
    const R = Math.min(SPAWN_R - 8, view * 0.85);
    if (R <= SPAWN_MIN) return;
    const ang = Math.random() * Math.PI * 2, d = SPAWN_MIN + Math.random() * (R - SPAWN_MIN);
    const cx = p.pos.x + Math.cos(ang) * d, cz = p.pos.z + Math.sin(ang) * d;
    // pas trop près d'un autre joueur
    for (const o of players) if (Math.hypot(o.pos.x - cx, o.pos.z - cz) < SPAWN_MIN) return;
    const c = worldToHex(cx, cz);
    if (!this.world.isLoaded?.(c.q, c.r)) return;
    // tempéré : cochons et moutons sur l'herbe ; froid : renards et lièvres sur la neige
    const biome = this.world.gen.biomeAt(c.q, c.r);
    const region = TEMPERATE.has(biome) ? 'temperate' : biome === BIOME.SNOWY || this.world.gen.isCold(c.q, c.r) ? 'cold' : null;
    if (!region) return;
    const type = pick(WILD[region]);
    const ground = region === 'cold' ? [SNOW_GRASS, SNOW] : [GRASS];
    const group = type === 'fox' ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 3);
    for (let i = 0, made = 0; i < group * 3 && made < group && n + made < NEAR_CAP; i++) {
      const q = c.q + Math.floor(Math.random() * 7) - 3, r = c.r + Math.floor(Math.random() * 7) - 3;
      const y = this.groundTop(q, r, ground);
      if (y === null) continue;
      const w = hexToWorld(q, r);
      this.add(type, w.x, y, w.z);
      made++;
    }
  }

  // Zombies : la nuit, ils sortent de terre loin des joueurs (pas dans un village, pas sur
  // l'eau), au plus ZOMBIE_CAP autour de chacun
  zombieTick(dt, players, view) {
    this.zombieClock -= dt;
    if (this.zombieClock > 0 || !players.length || this.noSpawn) return;
    this.zombieClock = ZOMBIE_EVERY;
    if (!isNight(this.talk.time())) return;
    const p = players[Math.floor(Math.random() * players.length)];
    let n = 0;
    for (const a of this.list) if (SPECIES[a.type].hostile && !a.dead && Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) < ZOMBIE_R) n++;
    if (n >= ZOMBIE_CAP) return;
    const R = Math.min(ZOMBIE_R - 8, view * 0.8);
    if (R <= ZOMBIE_MIN) return;
    const ang = Math.random() * Math.PI * 2, d = ZOMBIE_MIN + Math.random() * (R - ZOMBIE_MIN);
    const x = p.pos.x + Math.cos(ang) * d, z = p.pos.z + Math.sin(ang) * d;
    for (const o of players) if (Math.hypot(o.pos.x - x, o.pos.z - z) < ZOMBIE_MIN) return;
    if (this.world.gen?.villagesNear?.(x, z, ZOMBIE_VILLAGE)?.length) return;
    const c = worldToHex(x, z);
    if (!this.world.isLoaded?.(c.q, c.r)) return;
    // sur le sol (pas sur l'eau, la lave ni les feuilles), deux cases d'air au-dessus
    for (let y = H - 2; y > Y_MIN; y--) {
      const id = this.blk(c.q, c.r, y);
      if (id === 0) continue;
      if (!SOLID[id] || isWater(id) || isLava(id) || isNaturalLeaves(id) || this.blk(c.q, c.r, y + 1) !== 0 || this.blk(c.q, c.r, y + 2) !== 0) return;
      const w = hexToWorld(c.q, c.r);
      this.add('zombie', w.x, y + 1, w.z);
      return;
    }
  }

  // Le ciel est-il ouvert au-dessus de lui ? (le soleil le brûle)
  underSky(a) {
    const { q, r } = worldToHex(a.pos.x, a.pos.z);
    for (let y = Math.floor(a.pos.y + 2); y < H; y++) if (this.blk(q, r, y) !== 0 && !isWater(this.blk(q, r, y))) return false;
    return true;
  }

  // Zombie : poursuit le joueur (en survie) ou le villageois le plus proche, le mord ; sinon il
  // erre. Le jour, au soleil, il brûle peu à peu.
  zombieThink(a, dt, players) {
    a.biteT = Math.max(0, (a.biteT || 0) - dt);
    a.strike = Math.max(0, (a.strike || 0) - dt);
    if (!isNight(this.talk.time()) && (a.sunT = (a.sunT || 0) - dt) <= 0) {
      a.sunT = 1;
      if (this.underSky(a)) {
        a.burnT = 1.5;
        a.hp -= 2;
        a.hurtT = 0.3;
        if (a.hp <= 0) { a.dead = true; a.deadT = 0; return; }
      }
    }
    // la proie la plus proche (à peu près à sa hauteur)
    let prey = null, best = CHASE_R, isPlayer = false;
    for (const p of players) {
      if (!this.canPrey(p)) continue;
      const d = Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z);
      if (d < best && Math.abs(p.pos.y - a.pos.y) < 6) { best = d; prey = p; isPlayer = true; }
    }
    for (const v of this.list) {
      if (!v.active || v.dead || !SPECIES[v.type].villager) continue;
      const d = Math.hypot(v.pos.x - a.pos.x, v.pos.z - a.pos.z);
      if (d < SCARE_R && v.state !== 'panic' && v.job !== 'guard' && !isSoldier(v) && Math.abs(v.pos.y - a.pos.y) < 4) {
        // il a vu un zombie : il s'enfuit en criant
        const l = d || 1;
        this.flee(v, (v.pos.x - a.pos.x) / l, (v.pos.z - a.pos.z) / l, 4);
        if (!(v.zSaid > 0)) { this.talk.say(v, Math.random() < 0.5 ? 'zombie' : 'run'); v.zSaid = 8; }
      }
      if (d < best && Math.abs(v.pos.y - a.pos.y) < 4) { best = d; prey = v; isPlayer = false; }
    }
    a.prey = prey;
    if (!prey) { this.think(a, dt); return; }
    const pos = prey.pos;
    a.state = 'walk';
    a.pace = CHASE_PACE;
    a.timer = 1;
    a.target = { x: pos.x, z: pos.z };
    a.headTarget = 0;
    if (best < BITE_R && Math.abs(pos.y - a.pos.y) < 1.6 && a.biteT <= 0) {
      a.biteT = BITE_EVERY;
      a.strike = 0.3;
      if (isPlayer) this.onBite?.(prey, BITE, a.pos.x, a.pos.z);
      else this.hit(prey, BITE, a.pos.x, a.pos.z);
    }
  }

  // Dessus libre (2 cases d'air au-dessus) de la colonne (q, r) s'il est d'un des blocs
  // `ground` (herbe, neige...), ou null
  groundTop(q, r, ground) {
    if (!this.world.isLoaded?.(q, r)) return null;
    for (let y = H - 2; y > Y_MIN; y--) {
      const id = this.blk(q, r, y);
      if (id === 0) continue;
      if (!ground.includes(id)) return null;
      return this.blk(q, r, y + 2) === 0 ? y + 1 : null;
    }
    return null;
  }

  // Villages : quand un joueur approche d'un village pas encore peuplé, ses habitants
  // apparaissent dans les maisons (un adulte par maison, et deux enfants)
  villageTick(dt, players) {
    this.villageClock -= dt;
    if (this.villageClock > 0 || !players.length || !this.world.gen?.villagesNear) return;
    this.villageClock = VILLAGE_LOOK;
    for (const p of players) {
      for (const v of this.world.gen.villagesNear(p.pos.x, p.pos.z, 96)) {
        if (this.populated.has(v.key) || !this.world.isLoaded?.(v.q, v.r)) continue;
        if (!v.doors.every(([q, r]) => this.world.isLoaded?.(q, r))) continue;
        this.populated.add(v.key);
        const c = hexToWorld(v.q, v.r);
        v.doors.forEach(([q, r, y], i) => {
          const w = hexToWorld(q, r);
          const a = this.add('villager', w.x, y, w.z);
          a.home = { x: c.x, z: c.z };
          if (i < 2) { const k = this.add('villager_child', w.x + 0.3, y, w.z + 0.3); k.home = { x: c.x, z: c.z }; }
        });
      }
    }
  }

  // ---------- Multijoueur ----------
  // Hôte : état des animaux actifs [[id, x, y, z, direction, drapeaux, espèce, graine, métier]]
  // (drapeaux : 1 frappé, 2 mort, 4 au travail ; métier : 1 + son rang dans JOB_KEYS, 0 sans)
  state() {
    const r = (v) => Math.round(v * 100) / 100;
    return this.list.filter((a) => a.active).map((a) => [a.id, r(a.pos.x), r(a.pos.y), r(a.pos.z), r(a.yaw), (a.hurtT > 0 ? 1 : 0) | (a.dead ? 2 : 0) | (a.work > 0 ? 4 : 0), SPECIES_KEYS.indexOf(a.type), a.seed, a.job ? JOB_KEYS.indexOf(a.job) + 1 : 0]);
  }

  // Client : l'état reçu de l'hôte
  applyState(list) {
    const seen = new Set();
    for (const e of list) {
      if (!Array.isArray(e) || e.length < 6 || !e.every(Number.isFinite)) continue;
      const [id, x, y, z, yaw, f] = e;
      const type = SPECIES_KEYS[e[6]] || 'pig';
      seen.add(id);
      let a = this.byId(id);
      if (!a || a.type !== type) { if (a) this.list.splice(this.list.indexOf(a), 1); a = this.add(type, x, y, z, yaw, id); }
      if (Number.isInteger(e[7])) a.seed = e[7];
      a.to.set(x, y, z);
      a.toYaw = yaw;
      if (f & 1 && a.hurtT <= 0) a.hurtT = 0.4;
      if (f & 2 && !a.dead) { a.dead = true; a.deadT = 0; }
      a.work = f & 4 ? 0.3 : 0;
      a.job = JOB_KEYS[e[8] - 1] || null;
      a.active = true;
    }
    this.list = this.list.filter((a) => seen.has(a.id));
  }

  // ---------- Affichage ----------
  draw(players = [], dt = 0) {
    if (!SPECIES_KEYS.every((k) => this.meshes[k])) return;
    let total = 0;
    const jobN = {}; // vêtements des métiers déjà placés
    for (const k in this.jobMeshes) jobN[k] = 0;
    for (const key of SPECIES_KEYS) {
      const sp = SPECIES[key], px = sp.px, meshes = this.meshes[key];
      // les plus proches d'abord, au plus MAX_DRAWN
      let shown = this.list.filter((a) => a.active && a.type === key);
      if (shown.length > MAX_DRAWN && players.length) {
        const p = players[0].pos;
        shown.sort((a, b) => (a.pos.x - p.x) ** 2 + (a.pos.z - p.z) ** 2 - (b.pos.x - p.x) ** 2 - (b.pos.z - p.z) ** 2);
        shown = shown.slice(0, MAX_DRAWN);
      }
      let i = 0;
      for (const a of shown) {
        // base : position, direction ; mort : il bascule sur le flanc ; le lièvre bondit
        const roll = a.dead ? Math.min(1, a.deadT / 0.45) * Math.PI / 2 : 0;
        const hop = sp.hop ? Math.abs(Math.sin(a.phase * 0.8)) * 0.22 * a.walk : 0;
        tmpE.set(0, a.yaw, roll, 'YXZ');
        tmpQ.setFromEuler(tmpE);
        tmpA.compose(tmpV.set(a.pos.x, a.pos.y + roll * 0.18 + hop, a.pos.z), tmpQ, tmpS);
        const color = a.hurtT > 0 || a.dead ? HURT : WHITE;
        const swing = Math.sin(a.phase) * 0.7 * a.walk;
        // au travail : les bras croisés montent et descendent (hache, pioche, truelle...)
        const arms = sp.hostile ? 1.45 + Math.sin(a.phase * 0.5) * 0.08 - (a.strike > 0 ? 0.6 : 0)
          : a.work > 0 ? 0.75 + Math.sin(a.wphase || 0) * 0.55 : 0.75;
        placeParts(meshes, i, a, px, color, swing, arms);
        const jm = a.job && this.jobMeshes[a.job];
        if (jm && jobN[a.job] < MAX_DRAWN) placeParts(jm, jobN[a.job]++, a, px, color, swing, arms);
        i++;
      }
      for (const { mesh, n } of meshes) uploadInstances(mesh, i * n);
      total += i;
    }
    for (const k in this.jobMeshes) {
      for (const { mesh } of this.jobMeshes[k]) uploadInstances(mesh, jobN[k]);
    }
    this.drawn = total;
  }
}

// Instances à dessiner : seulement les k premières sont envoyées à la carte graphique. Aucune
// (espèce absente des environs) : le mesh est caché, ni envoyé ni dessiné (même pas dans les
// ombres) ; avant, les ~85 meshes renvoyaient toutes leurs places à chaque image
function uploadInstances(mesh, k) {
  mesh.count = k;
  mesh.visible = k > 0;
  if (!k) return;
  for (const [attr, size] of [[mesh.instanceMatrix, 16], [mesh.instanceColor, 3]]) {
    if (!attr) continue;
    attr.clearUpdateRanges();
    attr.addUpdateRange(0, k * size);
    attr.needsUpdate = true;
  }
}

// Place les parties d'un animal (instance i de chaque mesh ; tmpA : sa position, sa direction)
function placeParts(meshes, i, a, px, color, swing, arms) {
  for (const { mesh, part, n } of meshes) {
    for (let k = 0; k < n; k++) {
      const [x, y, z] = part.at[k];
      const anim = Array.isArray(part.anim) ? part.anim[k] : part.anim;
      if (anim === 'legA' || anim === 'legB') tmpE.set(anim === 'legA' ? swing : -swing, 0, 0, 'XYZ');
      else if (anim === 'head') tmpE.set(0, a.headYaw, 0, 'YXZ');
      else if (anim === 'tail') tmpE.set(0.25, Math.sin(a.phase * 0.7 + 1) * 0.25, 0, 'YXZ');
      else if (anim === 'arms') tmpE.set(arms, 0, 0, 'XYZ');
      else tmpE.set(0, 0, 0);
      tmpQ.setFromEuler(tmpE);
      tmpM.compose(tmpV.set(x * px, y * px, z * px), tmpQ, tmpS).premultiply(tmpA);
      mesh.setMatrixAt(i * n + k, tmpM);
      mesh.setColorAt(i * n + k, color);
    }
  }
}

// Dégâts d'un coup donné avec l'objet tenu : à mains nues 1, épée 3 + palier, hache 2 + palier,
// autre outil 2
export function attackDamage(item) {
  const it = ITEMS[item];
  if (!it?.tool) return 1;
  if (it.tool === 'sword') return 3 + (it.tier || 1);
  if (it.tool === 'axe') return 2 + (it.tier || 1);
  return 2;
}
