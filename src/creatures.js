// Créatures des autres planètes (une espèce passive et une hostile, ou seulement une passive, par
// planète) et monstres de Hexa (la nuit, et dans les grottes). Modèles en prismes hexagonaux comme
// les animaux de Hexa (voir animals.js) ; leurs peaux sont dessinées par outils/textures-creatures.cjs,
// deux fois plus fines que le patron (res: 2).
// Partie : g (boîte de la texture), at (positions en pixels, z < 0 : devant), anim ; role : la
// couleur que l'outil lui donne (body, head, leg, tail, shell, glow, accent) ; pat : son motif
// (fur, scales, plates, rock, shadow, chitin) ; eyes / teeth / snout : le visage sur sa face avant ;
// glow : dessinée sans ombre (elle luit : les yeux des monstres dans le noir).
import { VOLTITE, IRON_INGOT, FLUORITE_INGOT, CRIMSONITE_INGOT, WOOL_WHITE } from './blocks.js?v=1.1.0-mx09tneh';

export const ALIEN_MEAT = 4066, ALIEN_MEAT_COOKED = 4067;
const BLUE_ICE = 3974;

const tex = (key) => `texture/entites/creatures/${key}.png`;
const roll = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const meat = (a) => [a.burnT > 0 ? ALIEN_MEAT_COOKED : ALIEN_MEAT, roll(1, 2)];
// pattes : à gauche et à droite, d'avant en arrière ; en trépied pour six pattes
const legs = (u, v, w, h, d, at) => ({ g: { w, h, d, u, v, y0: -h }, at, anim: at.length === 6 ? ['legA', 'legB', 'legB', 'legA', 'legA', 'legB'] : ['legA', 'legB', 'legB', 'legA'], role: 'leg' });
const pair = (x, y, z) => [[x, y, z], [-x, y, z]];
const six = (x, y, z0, dz) => [...pair(x, y, z0), ...pair(x, y, z0 + dz), ...pair(x, y, z0 + 2 * dz)];
const four = (x, y, z0, z1) => [...pair(x, y, z0), ...pair(x, y, z1)];
// yeux lumineux : deux petits prismes sur la face avant d'une tête (pivot at, décalage x, haut y0, avant z)
const glowEyes = (u, v, at, x, y0, z, w = 1, h = 1) => [
  { g: { w, h, d: 0.6, u, v, y0, x, z }, at, anim: 'head', role: 'glow', glow: true },
  { g: { w, h, d: 0.6, u, v, y0, x: -x, z }, at, anim: 'head', role: 'glow', glow: true },
];

export const ALIENS = {
  // ---------- Ocra : désert rouge en terrasses ----------
  ocra_crawler: {
    name: 'Rampeur de poussière', by: 'un rampeur de poussière', skin: tex('ocra_crawler'), tex: [64, 64], px: 1 / 16,
    health: 10, radius: 0.4, height: 0.45, walk: 0.9, panic: 3,
    headAt: [0, 4.5, -7],
    colors: { body: '#b8643a', head: '#c8774a', leg: '#7a3c22', tail: '#a8582f', accent: '#5a2a18', belly: '#e0b088', eye: '#f0d060' },
    parts: [
      { g: { w: 8, h: 14, d: 5, u: 0, v: 0, y0: -7, lie: true }, at: [[0, 4, 0]], role: 'body', pat: 'plates' },
      { g: { w: 6, h: 4, d: 6, u: 28, v: 0, y0: -2, z: -3 }, at: [[0, 4.5, -7]], anim: 'head', role: 'head', pat: 'plates', eyes: 'bug' },
      legs(28, 12, 2, 3, 2, six(5, 3, -4, 4)),
      { g: { w: 3, h: 8, d: 3, u: 40, v: 12, y0: -8, lie: true }, at: [[0, 4, 7]], anim: 'tail', role: 'tail', pat: 'plates' },
    ],
    hits: [[0, 0.25, 0.45], [0.65, 0.3, 0.25]],
    drop: () => null,
    meat,
  },
  ocra_prowler: {
    name: 'Rôdeur des canyons', by: 'un rôdeur des canyons', skin: tex('ocra_prowler'), tex: [64, 64], px: 1 / 16,
    health: 22, radius: 0.45, height: 1.0, walk: 1.3, panic: 3, hostile: true, noBurn: true, bite: 4, chase: 20,
    headAt: [0, 14, -8],
    colors: { body: '#8a3a22', head: '#9a4428', leg: '#5e2616', tail: '#6e2c1a', accent: '#e8c890', belly: '#c88a5a', eye: '#ffe040' },
    parts: [
      { g: { w: 7, h: 14, d: 7, u: 0, v: 0, y0: -7, lie: true }, at: [[0, 11, 0]], role: 'body', pat: 'fur', stripes: true },
      { g: { w: 7, h: 6, d: 7, u: 30, v: 0, y0: -3, z: -2 }, at: [[0, 14, -8]], anim: 'head', role: 'head', pat: 'fur', eyes: true, teeth: true, snout: true },
      { g: { w: 2, h: 3, d: 1, u: 24, v: 24, y0: 0, x: 2.5 }, at: [[0, 17, -8]], anim: 'head', role: 'accent' },
      { g: { w: 2, h: 3, d: 1, u: 24, v: 24, y0: 0, x: -2.5 }, at: [[0, 17, -8]], anim: 'head', role: 'accent' },
      { ...legs(0, 24, 3, 9, 3, four(2.5, 9, -5, 5)), pat: 'fur', claws: true },
      { g: { w: 2, h: 8, d: 2, u: 14, v: 24, y0: -8, lie: true }, at: [[0, 13, 7]], anim: 'tail', role: 'tail', pat: 'fur' },
    ],
    hits: [[0, 0.7, 0.5], [0.65, 0.9, 0.3]],
    drop: () => null,
    meat,
  },
  // ---------- Glacia : banquise et pics de glace ----------
  glacia_shell: {
    name: 'Carapace-givre', by: 'une carapace-givre', skin: tex('glacia_shell'), tex: [64, 64], px: 1 / 16,
    health: 16, radius: 0.55, height: 0.7, walk: 0.45, panic: 1.2,
    headAt: [0, 5, -7],
    colors: { body: '#6a7c88', head: '#7e909c', leg: '#52626e', shell: '#a8dcf0', accent: '#e8f8ff', belly: '#a8b8c4', eye: '#202830' },
    parts: [
      { g: { w: 12, h: 12, d: 5, u: 0, v: 0, y0: -6, lie: true }, at: [[0, 5, 0]], role: 'body', pat: 'scales' },
      { g: { w: 12, h: 12, d: 3, u: 0, v: 18, y0: -6, grow: 1, lie: true }, at: [[0, 8.5, 0]], role: 'shell' },
      { g: { w: 5, h: 4, d: 5, u: 36, v: 0, y0: -2, z: -2 }, at: [[0, 5, -7]], anim: 'head', role: 'head', pat: 'scales', eyes: 'cute' },
      { ...legs(36, 10, 3, 4, 3, four(5, 4, -4, 4)), pat: 'scales', claws: true },
    ],
    hits: [[0, 0.4, 0.6]],
    drop: () => [BLUE_ICE, roll(1, 2)],
    meat,
  },
  glacia_fang: {
    name: 'Croc-blizzard', by: 'un croc-blizzard', skin: tex('glacia_fang'), tex: [64, 64], px: 1 / 16,
    health: 20, radius: 0.4, height: 0.95, walk: 1.4, panic: 3, hostile: true, noBurn: true, bite: 3, chase: 22, pack: 2,
    headAt: [0, 12.5, -8],
    colors: { body: '#dfe8f0', head: '#e8f0f6', leg: '#b8c8d6', tail: '#c8d6e2', accent: '#6a8aa8', belly: '#f4f8fc', eye: '#40c8ff', glow: '#7fe0ff' },
    parts: [
      { g: { w: 6, h: 14, d: 7, u: 0, v: 0, y0: -7, lie: true }, at: [[0, 10, 0]], role: 'body', pat: 'fur' },
      { g: { w: 6, h: 6, d: 6, u: 28, v: 0, y0: -3, z: -2 }, at: [[0, 12.5, -8]], anim: 'head', role: 'head', pat: 'fur', eyes: true },
      { g: { w: 4, h: 3, d: 4, u: 28, v: 13, y0: -3, z: -6 }, at: [[0, 12, -8]], anim: 'head', role: 'accent', teeth: true, snout: true },
      { g: { w: 2, h: 3, d: 1, u: 46, v: 13, y0: 0, x: 2, z: -1 }, at: [[0, 15.5, -8]], anim: 'head', role: 'head' },
      { g: { w: 2, h: 3, d: 1, u: 46, v: 13, y0: 0, x: -2, z: -1 }, at: [[0, 15.5, -8]], anim: 'head', role: 'head' },
      { ...legs(0, 22, 2, 9, 2, four(2, 9, -5, 5)), pat: 'fur', claws: true },
      { g: { w: 2, h: 9, d: 2, u: 10, v: 22, y0: -9, lie: true }, at: [[0, 12, 7]], anim: 'tail', role: 'tail', pat: 'fur' },
      ...glowEyes(52, 13, [[0, 12.5, -8]], 1.4, 0.6, -5.5),
    ],
    hits: [[0, 0.65, 0.45], [0.65, 0.8, 0.3]],
    drop: () => (Math.random() < 0.5 ? [FLUORITE_INGOT, 1] : null),
    meat,
  },
  // ---------- Magmara : basalte et rivières de lave ----------
  magmara_slag: {
    name: 'Mange-scories', by: 'un mange-scories', skin: tex('magmara_slag'), tex: [64, 64], px: 1 / 16,
    health: 14, radius: 0.5, height: 0.7, walk: 0.7, panic: 2, lavaProof: true,
    headAt: [0, 5.5, -6.5],
    colors: { body: '#3a3434', head: '#443c3c', leg: '#2a2424', accent: '#ff7a20', belly: '#4a3a34', eye: '#ffb040' },
    parts: [
      { g: { w: 10, h: 12, d: 7, u: 0, v: 0, y0: -6, lie: true }, at: [[0, 6.5, 0]], role: 'body', pat: 'rock', cracks: true },
      { g: { w: 6, h: 4, d: 5, u: 36, v: 0, y0: -2, z: -2 }, at: [[0, 5.5, -6.5]], anim: 'head', role: 'head', pat: 'rock', eyes: 'cute' },
      { g: { w: 1, h: 1, d: 3, u: 36, v: 10, y0: -1, x: 2, z: -6 }, at: [[0, 4.5, -6.5]], anim: 'head', role: 'accent' },
      { g: { w: 1, h: 1, d: 3, u: 36, v: 10, y0: -1, x: -2, z: -6 }, at: [[0, 4.5, -6.5]], anim: 'head', role: 'accent' },
      { ...legs(46, 10, 2, 4, 2, six(5.5, 4, -4, 4)), pat: 'rock' },
    ],
    hits: [[0, 0.4, 0.55]],
    drop: () => [IRON_INGOT, roll(1, 2)],
    meat,
  },
  magmara_lava: {
    name: 'Bête de lave', by: 'une bête de lave', skin: tex('magmara_lava'), tex: [64, 64], px: 1 / 16,
    health: 30, radius: 0.55, height: 1.6, walk: 1.0, panic: 2, hostile: true, noBurn: true, lavaProof: true, bite: 5, chase: 16,
    headAt: [0, 18, -0.5],
    colors: { body: '#3a2420', head: '#4a2c22', leg: '#2a1a16', accent: '#ff8a20', belly: '#4a2a20', eye: '#fff060', glow: '#ffd040' },
    parts: [
      { g: { w: 10, h: 10, d: 7, u: 0, v: 0, y0: 0 }, at: [[0, 8, 0]], role: 'body', pat: 'rock', cracks: true },
      { g: { w: 8, h: 7, d: 7, u: 0, v: 18, y0: 0 }, at: [[0, 18, -0.5]], anim: 'head', role: 'head', pat: 'rock', cracks: true, teeth: 'glow' },
      { g: { w: 4, h: 11, d: 4, u: 32, v: 18, y0: -11 }, at: pair(7.5, 17.5, 0), anim: 'arms', role: 'leg', pat: 'rock', cracks: true, claws: true },
      { g: { w: 4, h: 8, d: 4, u: 36, v: 0, y0: -8 }, at: pair(3, 8, 0), anim: ['legA', 'legB'], role: 'leg', pat: 'rock', cracks: true },
      ...glowEyes(52, 0, [[0, 18, -0.5]], 1.8, 4, -4.3, 2, 1),
    ],
    hits: [[0, 0.8, 0.55], [0, 1.35, 0.4]],
    drop: () => [CRIMSONITE_INGOT, roll(1, 2)],
  },
  // ---------- PXT-1 : dunes et mesas de grès ----------
  pxt1_burrower: {
    name: 'Fouisseur des dunes', by: 'un fouisseur des dunes', skin: tex('pxt1_burrower'), tex: [64, 64], px: 1 / 16,
    health: 6, radius: 0.3, height: 0.6, walk: 1.6, panic: 5, shy: true, hop: true,
    headAt: [0, 6, -3],
    colors: { body: '#d8b878', head: '#e2c488', leg: '#a88a50', accent: '#b89058', belly: '#f4e4c0', eye: '#1a1410' },
    parts: [
      { g: { w: 6, h: 6, d: 7, u: 0, v: 0, y0: 0 }, at: [[0, 2, 0.5]], role: 'body', pat: 'fur', spots: true },
      { g: { w: 6, h: 5, d: 5, u: 28, v: 0, y0: 0, z: -2 }, at: [[0, 6, -3]], anim: 'head', role: 'head', pat: 'fur', eyes: 'cute', snout: true },
      { g: { w: 2, h: 5, d: 1, u: 28, v: 11, y0: 0, x: 1.8 }, at: [[0, 11, -3]], anim: 'head', role: 'accent', pat: 'fur' },
      { g: { w: 2, h: 5, d: 1, u: 28, v: 11, y0: 0, x: -1.8 }, at: [[0, 11, -3]], anim: 'head', role: 'accent', pat: 'fur' },
      { ...legs(36, 11, 2, 2, 2, four(2, 2, -2, 3)), pat: 'fur' },
    ],
    hits: [[0, 0.35, 0.35], [0.3, 0.55, 0.25]],
    drop: () => null,
    meat,
  },
  pxt1_lurker: {
    name: 'Guetteur des sables', by: 'un guetteur des sables', skin: tex('pxt1_lurker'), tex: [64, 64], px: 1 / 16,
    health: 18, radius: 0.5, height: 0.8, walk: 1.0, panic: 2, hostile: true, noBurn: true, bite: 4, chase: 9, ambush: true,
    headAt: [0, 4, -6],
    colors: { body: '#a8864a', head: '#b08c4c', leg: '#7a5e30', tail: '#96743c', accent: '#c03020', belly: '#d8c08a', eye: '#101010' },
    parts: [
      { g: { w: 9, h: 12, d: 4, u: 0, v: 0, y0: -6, lie: true }, at: [[0, 4, 0]], role: 'body', pat: 'chitin', stripes: true },
      { g: { w: 3, h: 7, d: 3, u: 28, v: 0, y0: 0 }, at: [[0, 5, 6]], role: 'tail', pat: 'plates' },
      { g: { w: 3, h: 3, d: 3, u: 42, v: 0, y0: 0, z: -2 }, at: [[0, 12, 6]], anim: 'tail', role: 'accent', pat: 'chitin' },
      { g: { w: 3, h: 3, d: 5, u: 28, v: 11, y0: -1.5 }, at: pair(3, 4, -8.5), anim: 'head', role: 'head', pat: 'chitin' },
      { ...legs(46, 11, 1, 3, 1, six(5, 3, -3, 3)), pat: 'chitin' },
    ],
    hits: [[0, 0.3, 0.55]],
    drop: () => [VOLTITE, roll(1, 3)],
  },
  // ---------- Nox : glaces fissurées, nuit presque sans fin ----------
  nox_firefly: {
    name: 'Luciole lente', by: 'une luciole lente', skin: tex('nox_firefly'), tex: [64, 64], px: 1 / 16,
    health: 4, radius: 0.3, height: 0.5, walk: 0.35, panic: 1.5,
    headAt: [0, 4, -4],
    colors: { body: '#283040', head: '#30384a', leg: '#1a2030', glow: '#a0ff70', accent: '#506080', belly: '#3a4458', eye: '#c0f0ff' },
    parts: [
      { g: { w: 4, h: 3, d: 4, u: 0, v: 12, y0: -1.5, z: -2 }, at: [[0, 4, -4]], anim: 'head', role: 'head', pat: 'chitin', eyes: 'bug' },
      { g: { w: 5, h: 6, d: 4, u: 0, v: 0, y0: -3, lie: true }, at: [[0, 4, -1]], role: 'body', pat: 'chitin' },
      { g: { w: 6, h: 7, d: 5, u: 20, v: 0, y0: -7, lie: true }, at: [[0, 4.5, 2]], role: 'glow', glow: true },
      { g: { w: 1, h: 3, d: 1, u: 24, v: 13, y0: 0, x: 1, z: -1 }, at: [[0, 5.5, -4]], anim: 'head', role: 'accent' },
      { g: { w: 1, h: 3, d: 1, u: 24, v: 13, y0: 0, x: -1, z: -1 }, at: [[0, 5.5, -4]], anim: 'head', role: 'accent' },
      legs(18, 13, 1, 2, 1, six(2.5, 2, -2, 2)),
    ],
    hits: [[0, 0.3, 0.35]],
    drop: () => (Math.random() < 0.6 ? [VOLTITE, 1] : null),
  },

  // ========== Monstres de Hexa ==========
  // L'Ombre : une silhouette très haute et maigre aux bras trop longs. Elle se fige dès qu'un joueur
  // la regarde, et fonce vers lui dès qu'il détourne les yeux (watched, rush). Elle se dissout au soleil.
  hexa_shade: {
    name: 'Ombre', by: 'une ombre', skin: tex('hexa_shade'), tex: [64, 64], px: 1 / 16,
    health: 40, radius: 0.4, height: 2.75, walk: 1.0, panic: 1, hostile: true, bite: 6, chase: 34, watched: true, rush: 3.4,
    headAt: [0, 36, 0],
    colors: { body: '#16131c', head: '#1b1722', leg: '#110e16', accent: '#cfc8d8', belly: '#1e1a26', glow: '#eef2ff', eye: '#ffffff' },
    parts: [
      { g: { w: 6, h: 14, d: 4, u: 0, v: 0, y0: 0 }, at: [[0, 20, 0]], role: 'body', pat: 'shadow', ribs: true },
      { g: { w: 5, h: 10, d: 6, u: 20, v: 0, y0: 0 }, at: [[0, 34, 0]], anim: 'head', role: 'head', pat: 'shadow', eyes: 'hollow', teeth: true },
      { g: { w: 2, h: 22, d: 2, u: 0, v: 18, y0: -22 }, at: pair(4.4, 33, 0), anim: 'arms', role: 'leg', pat: 'shadow' },
      { g: { w: 3, h: 5, d: 1, u: 8, v: 18, y0: -27 }, at: pair(4.4, 33, 0), anim: 'arms', role: 'leg', pat: 'shadow', claws: true },
      { g: { w: 2, h: 20, d: 2, u: 16, v: 18, y0: -20 }, at: pair(1.6, 20, 0), anim: ['legA', 'legB'], role: 'leg', pat: 'shadow' },
      ...glowEyes(24, 18, [[0, 34, 0]], 1.15, 6.6, -3.5, 0.7, 0.7),
    ],
    hits: [[0, 0.6, 0.35], [0, 1.5, 0.4], [0, 2.3, 0.35]],
    drop: () => (Math.random() < 0.5 ? [VOLTITE, roll(1, 2)] : null),
  },
  // Le Hurleur : une bête efflanquée, côtes saillantes, crête d'épines et yeux rouges ; chasse en
  // meute de trois, surtout la nuit (le jour aussi, parfois : le soleil ne le brûle pas), et court plus vite qu'un joueur.
  hexa_howler: {
    name: 'Hurleur', by: 'un hurleur', skin: tex('hexa_howler'), tex: [64, 64], px: 1 / 16,
    health: 18, radius: 0.45, height: 1.3, walk: 1.45, panic: 3, hostile: true, noBurn: true, bite: 3, chase: 28, pack: 3,
    headAt: [0, 16, -9],
    colors: { body: '#3a383f', head: '#423f48', leg: '#2a282e', tail: '#34323a', accent: '#18171b', belly: '#5e565c', bone: '#cfc6ae', eye: '#ff2a20', glow: '#ff3a20' },
    parts: [
      { g: { w: 7, h: 16, d: 7, u: 0, v: 0, y0: -8, lie: true }, at: [[0, 13, 0]], role: 'body', pat: 'fur', ribs: true },
      { g: { w: 7, h: 7, d: 7, u: 30, v: 0, y0: -3, z: -2 }, at: [[0, 16, -9]], anim: 'head', role: 'head', pat: 'fur', eyes: true },
      { g: { w: 4, h: 3, d: 5, u: 30, v: 14, y0: -3, z: -6.5 }, at: [[0, 16, -9]], anim: 'head', role: 'head', pat: 'fur', teeth: true, snout: true },
      { g: { w: 2, h: 4, d: 1, u: 48, v: 14, y0: 3.5, x: 2.6, z: -1 }, at: [[0, 16, -9]], anim: 'head', role: 'accent' },
      { g: { w: 2, h: 4, d: 1, u: 48, v: 14, y0: 3.5, x: -2.6, z: -1 }, at: [[0, 16, -9]], anim: 'head', role: 'accent' },
      { g: { w: 2, h: 3, d: 2, u: 54, v: 14, y0: 0 }, at: [[0, 16, -5], [0, 16, -1], [0, 16, 3]], role: 'accent' },
      { ...legs(0, 24, 3, 10, 3, four(2.5, 10, -5.5, 5.5)), pat: 'fur', claws: true },
      { g: { w: 2, h: 11, d: 2, u: 14, v: 24, y0: -11, lie: true }, at: [[0, 14, 8]], anim: 'tail', role: 'tail', pat: 'fur' },
      ...glowEyes(54, 22, [[0, 16, -9]], 1.9, 1.2, -6, 1.2, 1),
    ],
    hits: [[0, 0.8, 0.5], [0.7, 1.0, 0.35]],
    drop: () => null,
    meat,
  },
  // La Tisseuse : une araignée large comme un lit, huit yeux rouges ; elle vit dans les grottes et
  // les mines (de jour comme de nuit) et ne craint pas le soleil.
  hexa_weaver: {
    name: 'Tisseuse des grottes', by: 'une tisseuse des grottes', skin: tex('hexa_weaver'), tex: [64, 64], px: 1 / 16,
    health: 24, radius: 0.6, height: 0.9, walk: 1.25, panic: 2, hostile: true, noBurn: true, bite: 4, chase: 16, cave: true,
    headAt: [0, 5, -5],
    colors: { body: '#1e1822', head: '#261e2a', leg: '#1a141e', accent: '#c02424', belly: '#2a2030', glow: '#ff2a30', eye: '#ff3040' },
    parts: [
      { g: { w: 12, h: 12, d: 9, u: 0, v: 0, y0: -6, lie: true }, at: [[0, 8, 5]], role: 'body', pat: 'fur', spots: true },
      { g: { w: 8, h: 6, d: 8, u: 0, v: 22, y0: 0 }, at: [[0, 4.5, -5]], anim: 'head', role: 'head', pat: 'chitin' },
      { g: { w: 1, h: 3, d: 1, u: 34, v: 22, y0: -2, x: 1.3, z: -4.2 }, at: [[0, 4.5, -5]], anim: 'head', role: 'accent', claws: true },
      { g: { w: 1, h: 3, d: 1, u: 34, v: 22, y0: -2, x: -1.3, z: -4.2 }, at: [[0, 4.5, -5]], anim: 'head', role: 'accent', claws: true },
      { g: { w: 2, h: 12, d: 2, u: 40, v: 22, y0: -12, tilt: 0.95 }, at: [[3.5, 8, -6], [3.5, 8, -3], [3.5, 8, 0], [3.5, 8, 3]], anim: ['legA', 'legB', 'legA', 'legB'], role: 'leg', pat: 'fur', claws: true },
      { g: { w: 2, h: 12, d: 2, u: 40, v: 22, y0: -12, tilt: -0.95 }, at: [[-3.5, 8, -6], [-3.5, 8, -3], [-3.5, 8, 0], [-3.5, 8, 3]], anim: ['legB', 'legA', 'legB', 'legA'], role: 'leg', pat: 'fur', claws: true },
      ...glowEyes(50, 22, [[0, 4.5, -5]], 1.1, 3, -4.6, 1.3, 1.3),
      ...glowEyes(50, 22, [[0, 4.5, -5]], 2.6, 3.8, -4.4, 0.8, 0.8),
      ...glowEyes(50, 22, [[0, 4.5, -5]], 0.6, 4.8, -4.5, 0.7, 0.7),
    ],
    hits: [[0, 0.45, 0.65], [0.6, 0.4, 0.35]],
    drop: () => (Math.random() < 0.7 ? [WOOL_WHITE, roll(1, 2)] : null),
  },
};
// ========== La faune des biomes ==========
// Les planètes sans espèces à elles (voir PLANET_LIFE) ont la faune de leurs biomes : des créatures
// adaptées au froid, à la chaleur, au vide (sans air), au sec ou au tempéré, et des lanternes
// vivantes dans les biomes lumineux. Chacune reprend la forme d'une espèce (base), avec sa peau à
// elle ; leur teinte varie d'une planète à l'autre (vary : voir tintOf et animals.js).
const PLANT_CRYSTAL = 4581; // (voir alienflora.js)
const like = (base, key, o) => ({ ...ALIENS[base], hostile: false, lavaProof: false, ambush: false, ...o, skin: tex(key), colors: { ...ALIENS[base].colors, ...o.colors }, vary: true });
Object.assign(ALIENS, {
  froid_brouteur: like('glacia_shell', 'froid_brouteur', { name: 'Brouteur de givre', by: 'un brouteur de givre',
    colors: { body: '#8a9aa8', head: '#9aaab8', leg: '#5a6a78', shell: '#e8f4ff', accent: '#a0d8ff', belly: '#c8d4dc', eye: '#203040' },
    drop: () => (Math.random() < 0.4 ? [BLUE_ICE, 1] : null) }),
  froid_traqueur: like('glacia_fang', 'froid_traqueur', { name: 'Traqueur des glaces', by: 'un traqueur des glaces', hostile: true,
    colors: { body: '#c8d8e8', head: '#d0e0ee', leg: '#9ab0c4', tail: '#b0c4d6', accent: '#40608a', belly: '#eef4fa', eye: '#9a60ff', glow: '#c090ff' },
    drop: () => (Math.random() < 0.4 ? [FLUORITE_INGOT, 1] : null) }),
  chaud_rampant: like('magmara_slag', 'chaud_rampant', { name: 'Rampant des cendres', by: 'un rampant des cendres', lavaProof: true,
    colors: { body: '#4a3e38', head: '#54463e', leg: '#30282a', accent: '#ffb030', belly: '#5a4a40', eye: '#ffd060' },
    drop: () => (Math.random() < 0.5 ? [IRON_INGOT, 1] : null) }),
  chaud_salamandre: like('ocra_prowler', 'chaud_salamandre', { name: 'Salamandre de braise', by: 'une salamandre de braise', hostile: true, lavaProof: true,
    colors: { body: '#6a1e10', head: '#7a2614', leg: '#4a140a', tail: '#8a2a10', accent: '#ffb040', belly: '#c8501a', eye: '#fff080' },
    drop: () => (Math.random() < 0.5 ? [CRIMSONITE_INGOT, 1] : null) }),
  vide_lithophage: like('ocra_crawler', 'vide_lithophage', { name: 'Lithophage', by: 'un lithophage',
    colors: { body: '#7a7a80', head: '#8a8a90', leg: '#4a4a50', tail: '#6a6a70', accent: '#3a3a40', belly: '#a8a8ae', eye: '#60e0ff' } }),
  vide_spectre: like('pxt1_lurker', 'vide_spectre', { name: 'Rôdeur du vide', by: 'un rôdeur du vide', hostile: true, ambush: true,
    colors: { body: '#2a2a38', head: '#323244', leg: '#1a1a24', tail: '#24243a', accent: '#8a40ff', belly: '#4a4a60', eye: '#c0a0ff' },
    drop: () => [VOLTITE, roll(1, 2)] }),
  sec_sauteur: like('pxt1_burrower', 'sec_sauteur', { name: 'Sauteur des dunes', by: 'un sauteur des dunes',
    colors: { body: '#c88a50', head: '#d49a60', leg: '#9a6a3a', accent: '#a8703a', belly: '#f0d0a0', eye: '#1a1410' } }),
  sec_dard: like('pxt1_lurker', 'sec_dard', { name: 'Dard des sables', by: 'un dard des sables', hostile: true, ambush: true,
    colors: { body: '#b8703a', head: '#c07a40', leg: '#8a5028', tail: '#a86030', accent: '#30c0a0', belly: '#e0b080', eye: '#101010' },
    drop: () => (Math.random() < 0.5 ? [VOLTITE, 1] : null) }),
  tempere_paisseur: like('ocra_crawler', 'tempere_paisseur', { name: 'Paisseur à six pattes', by: 'un paisseur',
    colors: { body: '#5a8a4a', head: '#6a9a58', leg: '#3a5a2e', tail: '#4a7a3e', accent: '#e0d060', belly: '#b8d0a0', eye: '#202010' } }),
  tempere_rodeur: like('ocra_prowler', 'tempere_rodeur', { name: 'Rôdeur des prairies', by: 'un rôdeur des prairies', hostile: true,
    colors: { body: '#4a5a3a', head: '#566844', leg: '#2e3a24', tail: '#3e4c30', accent: '#d8c890', belly: '#8a9a70', eye: '#ffcc30' } }),
  lum_luciole: like('nox_firefly', 'lum_luciole', { name: 'Lanterne vivante', by: 'une lanterne vivante',
    colors: { body: '#302848', head: '#3a3058', leg: '#1e1830', glow: '#ff70d0', accent: '#8060c0', belly: '#4a4060', eye: '#ffe0ff' },
    drop: () => (Math.random() < 0.35 ? [PLANT_CRYSTAL, 1] : null) }),
});
// (peaux deux fois plus fines que le patron)
for (const sp of Object.values(ALIENS)) sp.res = 2;

// Qui vit où (les autres planètes et lunes restent sans vie)
export const PLANET_LIFE = {
  ocra: { passive: ['ocra_crawler'], hostile: ['ocra_prowler'] },
  glacia: { passive: ['glacia_shell'], hostile: ['glacia_fang'] },
  magmara: { passive: ['magmara_slag'], hostile: ['magmara_lava'] },
  pxt1: { passive: ['pxt1_burrower'], hostile: ['pxt1_lurker'] },
  nox: { passive: ['nox_firefly'], hostile: [] },
};

// La faune des biomes (les autres planètes : voir faunaOf)
export const FAUNA = {
  froid: { name: 'du froid', passive: ['froid_brouteur'], hostile: ['froid_traqueur'] },
  chaud: { name: 'de la chaleur', passive: ['chaud_rampant'], hostile: ['chaud_salamandre'] },
  vide: { name: 'du vide', passive: ['vide_lithophage'], hostile: ['vide_spectre'] },
  sec: { name: 'des terres sèches', passive: ['sec_sauteur'], hostile: ['sec_dard'] },
  tempere: { name: 'des terres tempérées', passive: ['tempere_paisseur'], hostile: ['tempere_rodeur'] },
  lumineux: { name: 'des biomes lumineux', passive: ['lum_luciole'], hostile: [] },
};
// Le genre de faune d'un endroit : selon son biome (son nom) et la planète (son air, sa température)
export function faunaClass(body, biome) {
  const n = (biome || '').toLowerCase(), T = body.temp ?? 0, air = body.atmo?.density ?? 0;
  if (/lumin|champignon|aurore|luciole|cristaux/.test(n)) return 'lumineux';
  if (/lave|magma|volcan|braise|incandescent|caldeira|scorie|hornito|fumerolle|calcin|brûl/.test(n)) return 'chaud';
  if (air < 0.05) return 'vide';
  if (T > 90) return 'chaud';
  if (/glace|givre|neige|banquise|glaci|calotte|cryo|azote|pergél|toundra|gel|sérac|pénitent|inlandsis|nunatak|méthane/.test(n) || T < -40) return 'froid';
  if (/dune|désert|sable|sel|mesa|ocre|poussière|aride|steppe|savane|erg |regs|badland|canyon|grès|oued|terre cuite/.test(n) || T > 35) return 'sec';
  return 'tempere';
}
// Les espèces d'un endroit d'une planète (body) : les siennes, sinon celles de son biome
export function faunaOf(body, biome) {
  if (!body || body.kind === 'home') return null;
  return PLANET_LIFE[body.id] || FAUNA[faunaClass(body, biome)];
}
// La teinte des créatures d'une planète (vary) : [r, g, b], la même pour tous les joueurs
export function tintOf(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const u = (k) => (((h = Math.imul(h ^ (h >>> 15), 2246822507 + k)) >>> 0) / 4294967296);
  const t = [0.72 + u(1) * 0.5, 0.72 + u(2) * 0.5, 0.72 + u(3) * 0.5], m = Math.max(...t);
  return t.map((v) => (v / m) * 1.08);
}

// Ce qu'elles peuvent laisser (vérifié à la réception en multijoueur)
export const ALIEN_DROPS = [ALIEN_MEAT, ALIEN_MEAT_COOKED, BLUE_ICE, FLUORITE_INGOT, IRON_INGOT, CRIMSONITE_INGOT, VOLTITE, WOOL_WHITE, PLANT_CRYSTAL];

// Œufs d'apparition (créatif) : un par espèce, à partir de 4070
export const ALIEN_EGG = 4070;
