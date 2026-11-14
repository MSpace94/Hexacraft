// Le système de l'étoile Hexa : la source unique de ce qu'il y a dans l'espace, pour la
// cinématique d'arrivée (intro.js), le vol spatial (spaceflight.js), le ciel et la génération des
// planètes où l'on se pose (planetgen.js).
//
// Échelle : des blocs. Les astres ont des tailles et des distances réalistes entre eux (une
// planète est des centaines de fois plus loin de l'étoile que son rayon) : traverser le système
// fait des centaines de millions de blocs (voir le saut nédrolytique, spaceflight.js).
// Les orbites sont des cercles légèrement inclinés autour de l'étoile, ou d'une planète pour
// les lunes ; elles avancent avec les jours du jeu (period : en jours). Chaque astre tourne aussi
// sur lui-même (day : la durée de son jour, en jours de jeu ; il n'en est tenu compte que pour
// l'éclairage vu de l'espace, voir spaceflight.js).
// soi : la sphère d'influence (rayon, en blocs) : dedans, on suit l'astre dans sa course.
//
// Tous les astres solides sont des mondes où l'on peut se poser (gen : voir planetgen.js). Les
// géantes n'ont pas de sol : on peut y plonger, mais la pression finit par écraser la fusée.
// Les systèmes ajoutés à la main (src/systemes/, voir customsys.js) viennent à la suite.
// Ce fichier ne dépend que d'eux : les threads de génération le lisent aussi.
//
// atmo : air respirable (breath), couleur du ciel le jour et à l'horizon, densité (0 : le vide ;
// règle aussi la traînée et l'échauffement à l'entrée), temp : température moyenne (°C).
// colors : la palette vue de l'espace (si le terrain n'en donne pas). Les blocs : blocks.js.

import { SYSTEMES } from './systemes/index.js?v=1.1.5-alpha-mwgq2wrb';
import { buildSystems } from './customsys.js?v=1.1.5-alpha-mwgq2wrb';

const B = {
  STONE: 3, GRAVEL: 244, SAND: 8, DUNE: 626, SNOW: 37, WATER: 7, ICE_WATER: 200, LAVA: 72, MAGMA: 73, BASALT: 68, ASH: 69,
  SULFUR: 70, TUFF: 71, OBSIDIAN: 74, DIORITE: 261, SLATE: 745, CLAY: 603, CRACKED: 605, GRANITE: 617, SANDSTONE: 627,
  IRON: 60, VOLTITE: 61, IMPURE: 87, COAL: 30, PLATINUM: 83, TUNGSTEN: 85, FLUORITE: 640, CRIMSONITE: 642,
  REGOLITH: 3969, MOON_ROCK: 3970, OCHRE_SAND: 3971, RED_ROCK: 3972, ICE: 3973, BLUE_ICE: 3974, NITROGEN_ICE: 3975,
  THOLIN: 3976, SALT: 3977, IO_SULFUR: 3978, PERMAFROST: 3979, LAYERED: 3980, ASH_ROCK: 3981, CRACKED_ICE: 3982,
  DIRT: 2, LICHEN: 3997, PINK_NITROGEN: 4083,
  SLAG: 4084, GLOW_CRUST: 4085, GRAPHITE: 4086, RAW_DIAMOND: 4087, CRYSTAL_PLANT: 4088, BLACK_GLASS: 4089, REEF: 4090,
  RADIO_SOIL: 4091, CRYSTAL_SAND: 4092, QUARTZ: 4093, BLACK_DUST: 4094, GLOW_ICE: 4095,
};

export const STAR = {
  id: 'star', name: 'Hexa', kind: 'star', R: 700000, color: '#fff1d0', corona: '#ffb048', gravity: 28,
  desc: 'Naine jaune. Rien ne survit à sa surface.',
};

// (une année-lumière, en blocs : l'orbite d'Hexa vaut une unité astronomique)
export const LY = 63241 * 6.6e7;
export const BODIES = [
  // ---------- Planètes rocheuses ----------
  {
    id: 'magmara', name: 'Magmara', kind: 'rock', parent: 'star', orbit: 2.4e7, period: 30, day: 30, R: 5200, tilt: 0.02, soi: 120000,
    gravity: 0.8, temp: 430, desc: 'Collée à l\'étoile, sa face de jour fond. Volcans, fleuves de lave, plaines de basalte.',
    atmo: { breath: false, sky: '#3a1810', horizon: '#9a4420', density: 0.15, rim: '#ff7a3a' },
    colors: { low: '#ff5a10', mid: '#2e2624', high: '#4a3e3a', peak: '#6a5a52', sea: '#ff6a18' },
    gen: { style: 'volcanic', base: 56, amp: 30, sea: 50, fluid: B.LAVA, top: B.BASALT, sub: B.ASH_ROCK, rock: B.BASALT, deep: B.OBSIDIAN,
      ores: [[B.CRIMSONITE, 0.012, 60], [B.IRON, 0.008, 50], [B.OBSIDIAN, 0.01, 30], [B.TUNGSTEN, 0.004, 25]], hot: true },
  },
  {
    id: 'soufra', name: 'Soufra', kind: 'rock', parent: 'star', orbit: 4.2e7, period: 70, day: 6, R: 11500, tilt: 0.05, soi: 350000,
    gravity: 0.9, temp: 210, desc: 'Atmosphère épaisse et jaune, toxique. Mers de dunes, plateaux stratifiés, canyons. La voltite y affleure.',
    atmo: { breath: false, sky: '#c8a040', horizon: '#f0d478', density: 1.6, rim: '#ffe070' },
    colors: { low: '#c8a020', mid: '#e0c060', high: '#b08a50', peak: '#f2e6b0', sea: '#8a6a10' },
    gen: { style: 'desert', base: 64, amp: 26, sea: -999, fluid: 0, top: B.DUNE, sub: B.SULFUR, rock: B.LAYERED, deep: B.TUFF,
      ores: [[B.VOLTITE, 0.03, 90], [B.IMPURE, 0.02, 60], [B.IRON, 0.006, 40], [B.SALT, 0.01, 70]] },
  },
  {
    id: 'hexa', name: 'Hexa', kind: 'home', parent: 'star', orbit: 6.6e7, period: 120, day: 1, R: 14000, tilt: 0.4, soi: 1200000,
    gravity: 1, temp: 15, desc: 'La planète d\'origine : océans, forêts, montagnes. Au cœur de la ceinture intérieure.',
    atmo: { breath: true, sky: '#4a8ad8', horizon: '#b8daf4', density: 1, rim: '#78b8ff' },
    colors: { low: '#2a6ab0', mid: '#4a8a3a', high: '#7a7064', peak: '#f0f4f8', sea: '#2a62a8' },
  },
  {
    id: 'lune', name: 'Lune de Hexa', kind: 'moon', parent: 'hexa', orbit: 4.2e5, period: 8, day: 8, R: 3800, tilt: 0.03, soi: 90000,
    gravity: 0.17, temp: -20, desc: 'Grise, sans air. Hautes terres claires criblées de cratères, mers de basalte sombre, tunnels de lave.',
    atmo: { breath: false, sky: '#000000', horizon: '#000000', density: 0, rim: null },
    colors: { low: '#4e4e52', mid: '#8a8a8e', high: '#a8a8ac', peak: '#c8c8cc', sea: '#3a3a3e' },
    gen: { style: 'moon', base: 60, amp: 18, sea: -999, fluid: 0, top: B.REGOLITH, sub: B.REGOLITH, rock: B.MOON_ROCK, deep: B.BASALT, maria: B.BASALT,
      ores: [[B.PLATINUM, 0.006, 40], [B.TUNGSTEN, 0.005, 30], [B.IRON, 0.008, 50]] },
  },
  {
    id: 'ocra', name: 'Ocra', kind: 'rock', parent: 'star', orbit: 1.0e8, period: 220, day: 1.03, R: 7400, tilt: 0.44, soi: 500000,
    gravity: 0.38, temp: -60, desc: 'La planète rouge : déserts de poussière ocre, un canyon immense, un volcan géant, des calottes de glace aux pôles.',
    atmo: { breath: false, sky: '#c89070', horizon: '#e8c0a0', density: 0.12, rim: '#f0b090' },
    colors: { low: '#8a3a20', mid: '#b4602c', high: '#9a4a2a', peak: '#e8e4e0', sea: '#6a2a1a' },
    gen: { style: 'mars', base: 62, amp: 30, sea: -999, fluid: 0, top: B.OCHRE_SAND, sub: B.PERMAFROST, rock: B.RED_ROCK, deep: B.BASALT,
      ores: [[B.IRON, 0.02, 70], [B.PLATINUM, 0.004, 30], [B.FLUORITE, 0.004, 40], [B.ICE, 0.01, 50]] },
  },
  // ---------- Géante gazeuse et ses lunes ----------
  {
    id: 'orgon', name: 'Orgon', kind: 'gas', parent: 'star', orbit: 3.4e8, period: 900, day: 0.4, R: 150000, tilt: 0.05, soi: 2.4e7,
    gravity: 2.5, temp: -110, desc: 'Géante gazeuse aux bandes orange et crème, et sa grande tache. Pas de sol : plus on descend, plus la pression écrase.',
    atmo: { breath: false, sky: '#c98a4b', horizon: '#f0d6a8', density: 3, rim: '#ffc890' },
    bands: ['#c98a4b', '#e2b884', '#a0623a', '#f0d6a8', '#b8763f', '#d9a066', '#8a4f2c', '#ecd0a0'], spot: '#b5442c',
  },
  {
    id: 'brasia', name: 'Brasia', kind: 'moon', parent: 'orgon', orbit: 1.1e6, period: 2, day: 2, R: 3600, tilt: 0, soi: 70000,
    gravity: 0.18, temp: -140, desc: 'Lune volcanique d\'Orgon, broyée par ses marées : plaines de soufre jaune et orange, puits de lave partout.',
    atmo: { breath: false, sky: '#000000', horizon: '#100804', density: 0, rim: null },
    colors: { low: '#5a2a10', mid: '#e4a82a', high: '#f0d850', peak: '#f8f0c0', sea: '#ff6a18' },
    gen: { style: 'io', base: 58, amp: 16, sea: -999, fluid: 0, top: B.IO_SULFUR, sub: B.SULFUR, rock: B.BASALT, deep: B.MAGMA,
      ores: [[B.SULFUR, 0.03, 70], [B.VOLTITE, 0.01, 50], [B.CRIMSONITE, 0.006, 40]], hot: true },
  },
  {
    id: 'azura', name: 'Azura', kind: 'moon', parent: 'orgon', orbit: 1.8e6, period: 4, day: 4, R: 3300, tilt: 0, soi: 70000,
    gravity: 0.13, temp: -160, desc: 'Lune d\'Orgon couverte d\'une croûte de glace rayée de fissures brunes. Dessous : un océan d\'eau liquide.',
    atmo: { breath: false, sky: '#000000', horizon: '#04080c', density: 0, rim: null },
    colors: { low: '#8a5a40', mid: '#d8e4ea', high: '#eef4f6', peak: '#ffffff', sea: '#a06a4a' },
    gen: { style: 'europa', base: 60, amp: 6, sea: 30, fluid: B.WATER, top: B.ICE, sub: B.ICE, rock: B.STONE, deep: B.BASALT,
      ores: [[B.FLUORITE, 0.008, 20], [B.PLATINUM, 0.004, 0], [B.SALT, 0.02, 60]] },
  },
  // ---------- Géante de glace et sa lune ----------
  {
    id: 'cryos', name: 'Cryos', kind: 'ice', parent: 'star', orbit: 6.6e8, period: 2400, day: 0.7, R: 60000, tilt: 1.2, soi: 2.2e7,
    gravity: 1.1, temp: -200, desc: 'Géante de glace couchée sur le côté, entourée d\'anneaux d\'hexagones. Pas de sol.',
    atmo: { breath: false, sky: '#6ab0c8', horizon: '#c8eef4', density: 2.5, rim: '#a8f0ff' },
    bands: ['#8ac8d8', '#a8dce8', '#7ab8cc', '#bfe6ee', '#94ccdc'], rings: [[1.35, 1.6, 0.55], [1.68, 1.85, 0.35], [1.95, 2.2, 0.25]],
  },
  {
    id: 'glacia', name: 'Glacia', kind: 'moon', parent: 'cryos', orbit: 1.4e6, period: 6, day: 6, R: 5600, tilt: 0.1, soi: 120000,
    gravity: 0.25, temp: -180, desc: 'Lune de Cryos à l\'air froid et brumeux. Banquises de glace bleue, crevasses, mers d\'eau glaciale, geysers.',
    atmo: { breath: false, sky: '#24344c', horizon: '#7a96b8', density: 0.6, rim: '#a8d0ff' },
    colors: { low: '#5a90c0', mid: '#e8f0f8', high: '#b8d0e4', peak: '#ffffff', sea: '#3a70a8' },
    gen: { style: 'glacier', base: 62, amp: 24, sea: 56, fluid: B.ICE_WATER, top: B.SNOW, sub: B.ICE, rock: B.BLUE_ICE, deep: B.DIORITE,
      ores: [[B.FLUORITE, 0.02, 80], [B.PLATINUM, 0.012, 50], [B.IRON, 0.006, 40]], cold: true },
  },
  // ---------- Au-delà : la planète naine ----------
  {
    id: 'nox', name: 'Nox', kind: 'dwarf', parent: 'star', orbit: 1.6e9, period: 9000, day: 6, R: 2600, tilt: 2.1, soi: 300000,
    gravity: 0.07, temp: -230, desc: 'Planète naine glacée aux confins du système : plaines de glace d\'azote, montagnes de glace, terres sombres de tholins.',
    atmo: { breath: false, sky: '#020308', horizon: '#141c2c', density: 0.02, rim: '#8aa0d0' },
    colors: { low: '#3a2018', mid: '#e8e0d4', high: '#c8b8a0', peak: '#ffffff', sea: '#5a3a28' },
    gen: { style: 'pluto', base: 60, amp: 22, sea: -999, fluid: 0, top: B.NITROGEN_ICE, sub: B.ICE, rock: B.BLUE_ICE, deep: B.STONE,
      ores: [[B.TUNGSTEN, 0.008, 30], [B.PLATINUM, 0.008, 30], [B.FLUORITE, 0.01, 40]], cold: true },
  },
];
// ---------- Le second système : le trou noir Érèbe, à 24,8 années-lumière d'Hexa ----------
const HOLE_BODIES = [
  {
    // R : l'horizon des événements ; c : la vitesse de la lumière du jeu (blocs/s). Voir holeG.
    id: 'erebe', name: 'Érèbe', kind: 'hole', parent: 'star', fixed: true, orbit: 24.8 * LY, period: 1, day: 1, R: 600000, tilt: 0.3, soi: 4e9,
    gravity: 0, c: 30000, color: '#ffb070', temp: -270,
    desc: 'Trou noir entouré de son disque d\'accrétion. Passé l\'horizon, rien ne revient, pas même la lumière.',
  },
  {
    // locked : rotation synchrone. Il montre toujours la même face à son astre (x = 0 : le point face à lui).
    id: 'vesper', name: 'Vesper', kind: 'rock', parent: 'erebe', orbit: 1.6e7, period: 13.6, day: 13.6, R: 26000, tilt: 0, soi: 300000, locked: true,
    gravity: 1.6, temp: 16, desc: 'Super-Terre figée face à Érèbe : un côté de lave en fusion, un côté de glace et de nuit éternelle. On ne vit que sur le fil du crépuscule.',
    atmo: { breath: true, sky: '#3a5a8a', horizon: '#e08848', density: 0.48, rim: '#ffb070' },
    colors: { low: '#7a3a18', mid: '#6a8a48', high: '#c8d4dc', peak: '#ffffff', sea: '#ff6a10' },
    gen: { style: 'twilight', base: 64, amp: 22, sea: 58, fluid: B.WATER, top: 1, sub: 2, rock: B.STONE, deep: B.BASALT,
      ores: [[B.CRIMSONITE, 0.02, 40], [B.TUNGSTEN, 0.012, 50], [B.IRON, 0.008, 60], [B.PLATINUM, 0.006, 30]], hot: true },
  },
  {
    id: 'pelagia', name: 'Pélagia', kind: 'rock', parent: 'erebe', orbit: 6e7, period: 98.7, day: 3, R: 16000, tilt: 0.2, soi: 400000,
    gravity: 0.8, temp: -140, desc: 'Planète-océan entièrement gelée : une banquise sans fin, des icebergs prisonniers de la glace, et un océan noir dessous.',
    atmo: { breath: false, sky: '#0a1424', horizon: '#5a7898', density: 0.12, rim: '#a0c8f0' },
    colors: { low: '#3a70a8', mid: '#dcecf6', high: '#a8cce4', peak: '#ffffff', sea: '#2a5a9a' },
    gen: { style: 'frozenocean', base: 62, amp: 6, sea: -999, fluid: 0, top: B.SNOW, sub: B.ICE, rock: B.BLUE_ICE, deep: B.STONE,
      ores: [[B.FLUORITE, 0.02, -20], [B.PLATINUM, 0.012, -20], [B.VOLTITE, 0.008, 30]], cold: true },
  },
];
BODIES.push(...HOLE_BODIES);

// ---------- Le troisième système : PXT, à 45 années-lumière d'Hexa ----------
// Deux étoiles : PXT-A au centre, et la naine rouge PXT-C sur une grande orbite autour d'elle.
// PXT-3 (tout près) et PXT-1 tournent autour de PXT-A ; PXT-2 autour de PXT-C.
// lum : l'éclat de l'étoile, comparé à Hexa (panneaux solaires, voir orbital.js)
const PXT_BODIES = [
  {
    id: 'pxta', name: 'PXT-A', kind: 'star', parent: 'star', fixed: true, orbit: 45 * LY, period: 1, day: 1, R: 900000, tilt: 0, soi: 5e9,
    color: '#f4f6ff', corona: '#a8c8ff', gravity: 32, lum: 2, temp: 6500,
    desc: 'Étoile blanche, plus grande et plus brillante qu\'Hexa. Le cœur du système PXT.',
  },
  {
    id: 'pxtc', name: 'PXT-C', kind: 'star', parent: 'pxta', orbit: 2.4e9, period: 6000, day: 1, R: 380000, tilt: 0, soi: 6e8,
    color: '#ffb08a', corona: '#ff5a30', gravity: 18, lum: 0.08, temp: 3200,
    desc: 'Naine rouge, la seconde étoile de PXT. Elle fait le tour de PXT-A, très loin d\'elle, avec sa planète.',
  },
  {
    id: 'pxt3', name: 'PXT-3', kind: 'rock', parent: 'pxta', orbit: 3.5e7, period: 25, day: 25, R: 6800, tilt: 0.02, soi: 160000,
    gravity: 1.1, temp: 380, desc: 'Tout près de PXT-A : un monde de fer brûlant, coulées de lave et plaines de basalte sombre.',
    atmo: { breath: false, sky: '#4a2014', horizon: '#c06030', density: 0.3, rim: '#ffa060' },
    colors: { low: '#ff6a20', mid: '#3a2a26', high: '#5a4640', peak: '#8a7064', sea: '#ff7a28' },
    gen: { style: 'ironworld', base: 58, amp: 26, sea: 52, fluid: B.LAVA, top: B.BASALT, sub: B.ASH_ROCK, rock: B.BASALT, deep: B.OBSIDIAN,
      ores: [[B.IRON, 0.025, 70], [B.TUNGSTEN, 0.01, 40], [B.CRIMSONITE, 0.006, 40]], hot: true },
  },
  {
    id: 'pxt1', name: 'PXT-1', kind: 'rock', parent: 'pxta', orbit: 1.5e8, period: 260, day: 1.4, R: 9000, tilt: 0.3, soi: 600000,
    gravity: 0.7, temp: 30, desc: 'Plus loin de PXT-A : un désert de sable et de grès sous un ciel pâle, à l\'air trop mince pour respirer.',
    atmo: { breath: false, sky: '#b8b4c8', horizon: '#ece4dc', density: 0.25, rim: '#f0e8ff' },
    colors: { low: '#a88a5a', mid: '#e0c890', high: '#c0a070', peak: '#f4ecd8', sea: '#7a6040' },
    gen: { style: 'sandstone', base: 64, amp: 24, sea: -999, fluid: 0, top: B.SAND, sub: B.SANDSTONE, rock: B.SANDSTONE, deep: B.STONE,
      ores: [[B.IRON, 0.015, 60], [B.COAL, 0.012, 70], [B.VOLTITE, 0.012, 50], [B.PLATINUM, 0.004, 30]] },
  },
  {
    id: 'pxt2', name: 'PXT-2', kind: 'rock', parent: 'pxtc', orbit: 2.2e7, period: 9, day: 9, R: 5200, tilt: 0.1, soi: 140000,
    gravity: 0.5, temp: -120, desc: 'La planète de PXT-C : la naine rouge chauffe à peine, tout est gelé. Glace bleue, neige et mers glaciales.',
    atmo: { breath: false, sky: '#2a1c24', horizon: '#9a6070', density: 0.3, rim: '#ff9a8a' },
    colors: { low: '#5a80a8', mid: '#e8e0e4', high: '#c0b0c0', peak: '#ffffff', sea: '#3a5a8a' },
    gen: { style: 'redice', base: 62, amp: 20, sea: 56, fluid: B.ICE_WATER, top: B.SNOW, sub: B.ICE, rock: B.BLUE_ICE, deep: B.DIORITE,
      ores: [[B.FLUORITE, 0.015, 60], [B.PLATINUM, 0.01, 40], [B.TUNGSTEN, 0.006, 30]], cold: true },
  },
];
BODIES.push(...PXT_BODIES);

// ---------- Le quatrième système : Pipiens, à 7,7 années-lumière d'Hexa ----------
// Deux étoiles autour de leur barycentre (bary : Cendre, 0,6 UA et e = 0,1 ; le barycentre est à
// 0,16 UA d'Azurion, Cendre a la grande orbite). Les planètes (circum) tournent autour des deux,
// au-delà de la zone interdite (0,2 à 1,7 UA). ecc : l'excentricité de l'orbite (ovale).
// (une UA : 6,6e7 blocs ; une année d'Hexa : 120 jours de jeu)
const AU = 6.6e7, YEAR = 120;
const PIPIENS_BODIES = [
  {
    id: 'azurion', name: 'Azurion', kind: 'star', parent: 'star', fixed: true, orbit: 7.7 * LY, period: 1, day: 1, R: 1190000, tilt: 0, soi: 6e9,
    color: '#eef4ff', corona: '#9ec4ff', gravity: 17, lum: 8, temp: 8000, bary: { with: 'cendre', share: 0.6 / 2.3 },
    desc: 'Naine blanc-bleu (A5V) : 1,7 masse solaire, 8 fois l\'éclat d\'Hexa, environ 8 000 K. L\'étoile principale du système Pipiens.',
  },
  {
    id: 'cendre', name: 'Cendre', kind: 'star', parent: 'azurion', orbit: 0.6 * AU, ecc: 0.1, period: 112 / 365.25 * YEAR, day: 1, R: 420000, tilt: 0, soi: 5e6,
    color: '#ffb478', corona: '#ff7a30', gravity: 46, lum: 0.08, temp: 4000,
    desc: 'Naine orange terne (K7V) : 0,6 masse solaire, environ 4 000 K. Elle tourne avec Azurion en 112 jours.',
  },
  {
    id: 'eldra', name: 'Eldra', kind: 'rock', parent: 'azurion', circum: true, orbit: 3.1 * AU, ecc: 0.1, period: 3.6 * YEAR, day: 27 / 24, R: 14700, tilt: 0.384, soi: 900000,
    gravity: 1.09, temp: 11, desc: 'Monde d\'océans (62 %) au ciel violet : deux continents, un archipel volcanique, la Cordillère d\'Orvane, une mer intérieure aux tapis microbiens, des plaines de sel blanc. Lichens et mousses violet-noir, aucune forêt. Air respirable.',
    atmo: { breath: true, sky: '#3a2a8c', horizon: '#e6eef8', density: 1.2, rim: '#b0bcff' },
    colors: { low: '#1e4a8a', mid: '#3a2a3e', high: '#6a6070', peak: '#f2f4f8', sea: '#1e4a8a' },
    gen: { style: 'eldra', base: 62, amp: 24, sea: 56, fluid: B.WATER, top: B.LICHEN, sub: B.DIRT, rock: B.STONE, deep: B.BASALT,
      ores: [[B.IRON, 0.012, 60], [B.COAL, 0.01, 70], [B.VOLTITE, 0.006, 40], [B.PLATINUM, 0.004, 30], [B.SALT, 0.006, 60]] },
  },
  {
    id: 'lunule', name: 'Lunule', kind: 'moon', parent: 'eldra', orbit: 2.85e5, period: 4, day: 4, R: 2100, tilt: 0.03, soi: 50000,
    gravity: 0.09, temp: -20, desc: 'La lune d\'Eldra : 1 900 km de diamètre, à 260 000 km.',
    atmo: { breath: false, sky: '#000000', horizon: '#000000', density: 0, rim: null },
    colors: { low: '#4e4e52', mid: '#8a8a8e', high: '#a8a8ac', peak: '#c8c8cc', sea: '#3a3a3e' },
    gen: { style: 'moon', base: 60, amp: 14, sea: -999, fluid: 0, top: B.REGOLITH, sub: B.REGOLITH, rock: B.MOON_ROCK, deep: B.BASALT, maria: B.BASALT,
      ores: [[B.IRON, 0.008, 50], [B.PLATINUM, 0.004, 30]] },
  },
  {
    id: 'glacyon', name: 'Glacyon', kind: 'rock', parent: 'azurion', circum: true, orbit: 30 * AU, ecc: 0.05, period: 108 * YEAR, day: 1.5, R: 11200, tilt: 0.1, soi: 500000,
    gravity: 0.31, temp: -193, desc: 'Monde de glace à 30 UA : plaines d\'azote gelé blanc-rose, montagnes de glace d\'eau, cryovolcans, dunes de tholins rouge-brun. Un océan probable sous la glace. Azurion n\'y est qu\'une étoile très brillante.',
    atmo: { breath: false, sky: '#020206', horizon: '#0c0a12', density: 0.01, rim: '#e0c8d0' },
    colors: { low: '#6a3424', mid: '#f0dcdc', high: '#d8e4ee', peak: '#ffffff', sea: '#6a3424' },
    gen: { style: 'glacyon', base: 60, amp: 22, sea: -999, fluid: 0, top: B.PINK_NITROGEN, sub: B.NITROGEN_ICE, rock: B.ICE, deep: B.STONE,
      ores: [[B.FLUORITE, 0.012, 40], [B.PLATINUM, 0.006, 30], [B.TUNGSTEN, 0.005, 20]], cold: true },
  },
];
BODIES.push(...PIPIENS_BODIES);

// ---------- Le cinquième système : Ethan, à 30 années-lumière d'Hexa ----------
// Deux étoiles à neutrons qui tournent l'une autour de l'autre (0,08 UA, 9,3 jours, e = 0,02) :
// Ethan Alpha, un pulsar (ses deux faisceaux balaient le système), et Ethan Bêta, un magnétar
// dormant. Presque pas de lumière visible : deux points noirs entourés d'un halo violet (pulsar,
// voir planetview.js). dim : la part de lumière qui arrive au sol de ses planètes (voir sky.js) ;
// aurora : Halo, éclairée par ses aurores et ses mers lumineuses. Les sept planètes tournent
// autour des deux (circum) ; Mourne a trois lunes.
// (le rayon de la Terre : 14 000 blocs, comme Hexa)
const RE = 14000, DAY = YEAR / 365.25;
const ETHAN_BODIES = [
  {
    id: 'ethana', name: 'Ethan Alpha', kind: 'star', pulsar: true, beams: true, parent: 'star', fixed: true, orbit: 30 * LY, period: 1, day: 1, R: 30000, tilt: 0.4, soi: 6e9,
    color: '#dce8ff', corona: '#4f8cff', gravity: 60, lum: 0.03, dim: 0.3, temp: 500000, bary: { with: 'ethanb', share: 1.3 / 2.7 },
    desc: "Pulsar « recyclé » : 1,4 masse solaire dans 24 km, 238 tours par seconde. Presque pas de lumière visible : des rayons X, et deux faisceaux radio qui balaient le système. Son vent de particules ronge les atmosphères.",
  },
  {
    id: 'ethanb', name: 'Ethan Bêta', kind: 'star', pulsar: true, parent: 'ethana', orbit: 0.08 * AU, ecc: 0.02, period: 9.3 * DAY, day: 1, R: 28000, tilt: 0, soi: 2e6,
    color: '#f2e4ff', corona: '#b05aff', gravity: 60, lum: 0.02, dim: 0.3, temp: 1000000,
    desc: "Magnétar dormant : 1,3 masse solaire, un tour en 7,8 s, un champ magnétique énorme. Tous les 40 ans environ, un éclair gamma stérilise les surfaces exposées. Dans 900 millions d'années, les deux étoiles fusionneront.",
  },
  {
    id: 'cinder', name: 'Cinder', kind: 'rock', parent: 'ethana', circum: true, orbit: 0.35 * AU, period: 61 * DAY, day: 61 * DAY, R: 0.5 * RE, tilt: 0, soi: 200000, locked: true,
    gravity: 0.6, temp: 900, desc: "Enfer métallique, à 70 % de fer, toujours la même face vers les pulsars : océans de fer fondu (900 °C) le jour, plaines de scories noires et croûte rouge-orange qui brille la nuit (-150 °C). Pas d'atmosphère.",
    atmo: { breath: false, sky: '#000000', horizon: '#060302', density: 0, rim: null },
    colors: { low: '#ff5a10', mid: '#1e1a18', high: '#2e2826', peak: '#a8300c', sea: '#ff6a18' },
    gen: { style: 'cinder', base: 58, amp: 24, sea: 52, fluid: B.LAVA, top: B.SLAG, sub: B.SLAG, rock: B.BASALT, deep: B.OBSIDIAN,
      ores: [[B.IRON, 0.05, 70], [B.TUNGSTEN, 0.012, 40], [B.PLATINUM, 0.006, 30], [B.CRIMSONITE, 0.005, 30]], hot: true },
  },
  {
    id: 'voss', name: 'Voss', kind: 'rock', parent: 'ethana', circum: true, orbit: 0.6 * AU, period: 170 * DAY, day: 1.2, R: 1.3 * RE, tilt: 0.1, soi: 800000,
    gravity: 1.4, temp: 120, desc: "Planète-diamant : plateaux de graphite noir mat, falaises de diamant brut qui luisent en bleu sous les rayons X, rivières de carbure, lacs d'hydrocarbures sombres. Air de CO₂ et de monoxyde de carbone, 3 atm.",
    atmo: { breath: false, sky: '#3a3028', horizon: '#7a6a58', density: 2.2, rim: '#c0a080' },
    colors: { low: '#0c0c10', mid: '#202024', high: '#2c2c31', peak: '#8ad8ff', sea: '#0c0c10' },
    gen: { style: 'voss', base: 62, amp: 30, sea: -999, fluid: 0, top: B.GRAPHITE, sub: B.GRAPHITE, rock: B.GRAPHITE, deep: B.BASALT,
      ores: [[B.RAW_DIAMOND, 0.03, 60], [B.COAL, 0.03, 80], [B.TUNGSTEN, 0.006, 30]], hot: true },
  },
  {
    id: 'halo', name: 'Halo', kind: 'rock', parent: 'ethana', circum: true, orbit: 0.9 * AU, period: 310 * DAY, day: 31 / 24, R: 1.1 * RE, tilt: 0.3, soi: 900000,
    gravity: 1.1, temp: 14, aurora: true, desc: "Le monde-oasis : un océan peu profond aux récifs bleu électrique, des forêts de cristaux végétaux, des plaines de verre noir, des falaises d'aurore. Pas de soleil : des aurores vertes, roses et dorées en permanence, et des mers lumineuses. Air respirable (1,4 atm).",
    atmo: { breath: true, sky: '#0a2a2a', horizon: '#3aa080', density: 1.4, rim: '#60ffb0' },
    colors: { low: '#1060c0', mid: '#12242c', high: '#3ae0c0', peak: '#e0fff8', sea: '#0a3a7a' },
    gen: { style: 'halo', base: 60, amp: 20, sea: 58, fluid: B.WATER, top: B.RADIO_SOIL, sub: B.DIRT, rock: B.STONE, deep: B.BASALT,
      ores: [[B.IRON, 0.012, 60], [B.FLUORITE, 0.01, 40], [B.VOLTITE, 0.008, 40], [B.PLATINUM, 0.004, 30]] },
  },
  {
    id: 'tessel', name: 'Tessel', kind: 'rock', parent: 'ethana', circum: true, orbit: 1.4 * AU, period: 1.2 * YEAR, day: 0.8, R: 0.9 * RE, tilt: 0.2, soi: 600000,
    gravity: 0.8, temp: -20, desc: "Désert cristallin de quartz et de sel recristallisés : dunes de cristal qui chantent au vent, canyons de verre, tempêtes électrostatiques violettes. Air mince (0,2 atm), nuits glaciales.",
    atmo: { breath: false, sky: '#6a5a9a', horizon: '#d8d0f0', density: 0.2, rim: '#c0a0ff' },
    colors: { low: '#b0a0d0', mid: '#e0dcec', high: '#d0c4e4', peak: '#ffffff', sea: '#b0a0d0' },
    gen: { style: 'tessel', base: 64, amp: 26, sea: -999, fluid: 0, top: B.CRYSTAL_SAND, sub: B.CRYSTAL_SAND, rock: B.QUARTZ, deep: B.STONE,
      ores: [[B.SALT, 0.02, 70], [B.FLUORITE, 0.014, 50], [B.VOLTITE, 0.01, 40], [B.PLATINUM, 0.005, 30]], cold: true },
  },
  {
    id: 'mourne', name: 'Mourne', kind: 'gas', parent: 'ethana', circum: true, orbit: 2.5 * AU, period: 3.3 * YEAR, day: 0.6, R: 7 * RE, tilt: 0.1, soi: 1.6e7,
    gravity: 1.6, temp: -60, desc: "Géant irradié (60 masses terrestres) : hydrogène et hélium, une ceinture de radiation extrême, des anneaux sombres de poussière de métal. Pas de sol.",
    atmo: { breath: false, sky: '#4a3a5a', horizon: '#9a8aa8', density: 3, rim: '#c8a0ff' },
    bands: ['#5a4a6a', '#7a6a88', '#4a3a58', '#8a7a98', '#6a5a78', '#3e3048'], rings: [[1.4, 1.75, 0.5], [1.85, 2.1, 0.3]], ringColor: 0x4a4440,
  },
  {
    id: 'ash', name: 'Ash', kind: 'moon', parent: 'mourne', orbit: 7e5, period: 2, day: 2, R: 3200, tilt: 0, soi: 60000,
    gravity: 0.17, temp: -90, desc: "Lune volcanique de Mourne : plaines de basalte, cônes de cendre, coulées de lave.",
    atmo: { breath: false, sky: '#000000', horizon: '#0c0604', density: 0, rim: null },
    colors: { low: '#ff5a10', mid: '#3e3a36', high: '#524d48', peak: '#8a8888', sea: '#ff6a18' },
    gen: { style: 'volcanic', base: 56, amp: 26, sea: 50, fluid: B.LAVA, top: B.BASALT, sub: B.ASH_ROCK, rock: B.BASALT, deep: B.OBSIDIAN,
      ores: [[B.CRIMSONITE, 0.01, 50], [B.SULFUR, 0.02, 60], [B.IRON, 0.008, 40]], hot: true },
  },
  {
    id: 'pale', name: 'Pale', kind: 'moon', parent: 'mourne', orbit: 1.1e6, period: 3.5, day: 3.5, R: 3000, tilt: 0, soi: 60000,
    gravity: 0.14, temp: -190, desc: "Lune glacée de Mourne : inlandsis, montagnes où la roche perce la glace, champs de crevasses.",
    atmo: { breath: false, sky: '#000000', horizon: '#04060a', density: 0, rim: null },
    colors: { low: '#5a90c0', mid: '#e8f0f8', high: '#b8d0e4', peak: '#ffffff', sea: '#5a90c0' },
    gen: { style: 'glacier', base: 62, amp: 20, sea: -999, fluid: 0, top: B.SNOW, sub: B.ICE, rock: B.BLUE_ICE, deep: B.STONE,
      ores: [[B.FLUORITE, 0.012, 40], [B.PLATINUM, 0.006, 30]], cold: true },
  },
  {
    id: 'orrin', name: 'Orrin', kind: 'moon', parent: 'mourne', orbit: 1.7e6, period: 6, day: 6, R: 5000, tilt: 0, soi: 100000,
    gravity: 0.2, temp: -170, desc: "La plus grande lune de Mourne : une croûte de glace rayée de fissures, et un océan d'eau liquide dessous.",
    atmo: { breath: false, sky: '#000000', horizon: '#04080c', density: 0, rim: null },
    colors: { low: '#8a5a40', mid: '#d8e4ea', high: '#eef4f6', peak: '#ffffff', sea: '#a06a4a' },
    gen: { style: 'europa', base: 60, amp: 6, sea: 30, fluid: B.WATER, top: B.ICE, sub: B.ICE, rock: B.STONE, deep: B.BASALT,
      ores: [[B.FLUORITE, 0.008, 20], [B.PLATINUM, 0.005, 0], [B.SALT, 0.02, 60]] },
  },
  {
    id: 'perse', name: 'Perse', kind: 'rock', parent: 'ethana', circum: true, orbit: 5 * AU, period: 11 * YEAR, day: 1.6, R: 1.6 * RE, tilt: 0.2, soi: 1.2e6,
    gravity: 1.2, temp: -180, desc: "Monde océanique glacé : 40 km de glace bleue fracturée sur un océan de 200 km. Cryovolcans géants, failles lumineuses où la glace laisse passer la lumière. Une vie cachée, peut-être.",
    atmo: { breath: false, sky: '#04060c', horizon: '#1a2a40', density: 0.05, rim: '#90d8ff' },
    colors: { low: '#2a6ac0', mid: '#5a9ad0', high: '#c8e6f4', peak: '#ffffff', sea: '#2a6ac0' },
    gen: { style: 'perse', base: 62, amp: 8, sea: 30, fluid: B.WATER, top: B.BLUE_ICE, sub: B.ICE, rock: B.BLUE_ICE, deep: B.STONE,
      ores: [[B.FLUORITE, 0.012, 20], [B.PLATINUM, 0.006, 0], [B.SALT, 0.015, 60]], cold: true },
  },
  {
    id: 'lethe', name: 'Lethe', kind: 'rock', parent: 'ethana', circum: true, orbit: 12 * AU, ecc: 0.3, period: 42 * YEAR, day: 2, R: 0.7 * RE, tilt: 0.5, soi: 500000,
    gravity: 0.5, temp: -220, desc: "La planète fantôme, capturée : totalement noire (albédo 0,02), plaines de poussière noire, crevasses profondes. L'été y dure quelques années, l'hiver des décennies. Aucune atmosphère.",
    atmo: { breath: false, sky: '#000000', horizon: '#000000', density: 0, rim: null },
    colors: { low: '#060606', mid: '#0e0e0f', high: '#171718', peak: '#2a2a2c', sea: '#060606' },
    gen: { style: 'lethe', base: 60, amp: 16, sea: -999, fluid: 0, top: B.BLACK_DUST, sub: B.BLACK_DUST, rock: B.BASALT, deep: B.OBSIDIAN,
      ores: [[B.IRON, 0.01, 40], [B.TUNGSTEN, 0.008, 30], [B.PLATINUM, 0.006, 20]], cold: true },
  },
];
BODIES.push(...ETHAN_BODIES);

// ---------- Les systèmes ajoutés (src/systemes/) ----------
// CUSTOM : le compte rendu (erreurs, avertissements) ; un système avec une erreur n'entre pas.
export const CUSTOM = buildSystems(SYSTEMES);
BODIES.push(...CUSTOM.bodies);
if (globalThis.document) {
  for (const e of CUSTOM.errors) console.error('Systèmes ajoutés : ' + e);
  for (const w of CUSTOM.warnings) console.warn('Systèmes ajoutés : ' + w);
}

// ceintures d'astéroïdes : [rayon intérieur, extérieur, épaisseur] (Hexa est dans la première)
export const BELTS = [[5.6e7, 7.6e7, 1.5e6], [1.1e9, 1.4e9, 2e7]];

export const BODY = Object.fromEntries([STAR, ...BODIES].map((b) => [b.id, b]));
export const LANDABLE = BODIES.filter((b) => b.gen || b.kind === 'home');
for (const b of BODIES) b.land = !!b.gen || b.kind === 'home';
// le type de monde d'une planète (Generator, voir gen.js) ; 'hexa' : le monde d'origine
export const planetOfType = (type) => (typeof type === 'string' && type.startsWith('planet:') && BODY[type.slice(7)]?.gen ? BODY[type.slice(7)] : null);
// Largeur du monde d'une planète, en blocs : son tour complet (2πR). La longitude va dans x, la
// latitude dans z (de +span/4 au pôle sud à -span/4 au pôle nord, voir planetview.dirToWorld) :
// de l'espace, on se pose là où on touche la planète.
export const spanOf = (b) => 2 * Math.PI * b.R;

// Phase de départ d'un astre (radians), tirée de la graine du monde (chaque monde a son ciel)
function phase(seed, id) {
  let h = 2166136261;
  for (const ch of String(seed) + ':' + id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) / 4294967296) * Math.PI * 2;
}

// Position d'un astre (blocs, origine : l'étoile) au jour de jeu day. out : { x, y, z }
export function bodyPos(id, day, seed, out = { x: 0, y: 0, z: 0 }) {
  const b = BODY[id];
  if (!b || b.id === 'star') { out.x = out.y = out.z = 0; return out; }
  if (b.fixed) { // (pas d'orbite : il est loin de tout, à sa distance exacte)
    fixedPos(b, seed, out);
    if (b.bary) { // (étoile double : elle tourne autour du barycentre, à l'opposé de sa compagne)
      const o = orbitOffset(BODY[b.bary.with], day, seed, _off), k = b.bary.share;
      out.x -= o.x * k; out.y -= o.y * k; out.z -= o.z * k;
    }
    return out;
  }
  const P = BODY[b.parent];
  let k = 1;
  if (P.bary && (b.circum || P.bary.with === b.id)) {
    fixedPos(P, seed, out); // (autour du barycentre : les planètes circumbinaires, et la compagne)
    if (!b.circum) k = 1 - P.bary.share;
  } else bodyPos(b.parent, day, seed, out);
  const px = out.x, py = out.y, pz = out.z, o = orbitOffset(b, day, seed, _off);
  out.x = px + o.x * k;
  out.z = pz + o.z * k;
  out.y = py + o.y * k;
  return out;
}
const _off = { x: 0, y: 0, z: 0 };
function fixedPos(b, seed, out) {
  if (b.at) { out.x = b.at.x; out.y = b.at.y; out.z = b.at.z; return out; } // (un système ajouté : à sa place, la même dans tous les mondes)
  const a = phase(seed, b.id), e = (phase(seed, b.id + '/i') - Math.PI) * 0.2;
  out.x = Math.cos(a) * Math.cos(e) * b.orbit;
  out.z = Math.sin(a) * Math.cos(e) * b.orbit;
  out.y = Math.sin(e) * b.orbit;
  return out;
}
// La place d'un astre sur son orbite, par rapport au centre de celle-ci : un cercle, ou une
// ellipse (ecc : on résout l'équation de Kepler ; le périastre est tiré de la graine)
function orbitOffset(b, day, seed, out) {
  const M = phase(seed, b.id) + (Math.PI * 2 * day) / b.period;
  let a = M, rad = b.orbit;
  if (b.ecc) {
    const e = b.ecc;
    let E = M;
    for (let n = 0; n < 4; n++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    a = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2)) + phase(seed, b.id + '/w');
    rad = b.orbit * (1 - e * Math.cos(E));
  }
  return tiltOrbit(b, seed, Math.cos(a) * rad, Math.sin(a) * rad, out);
}
// Le plan de l'orbite : (x, z), un point dans ce plan, mis à sa place dans l'espace.
// incl (radians) : l'inclinaison choisie (0 : à plat, π/2 : par les pôles, plus de π/2 : elle tourne
// à l'envers) ; node : la direction (radians, autour de y) de son point le plus haut. Sans incl
// (Hexa, et les systèmes qui ne la donnent pas) : presque à plat, une petite pente tirée de la graine
export function tiltOrbit(b, seed, x, z, out) {
  if (b.incl === undefined) {
    const inc = b.locked ? 0 : (phase(seed, b.id + '/i') - Math.PI) * 0.012;
    out.x = x; out.y = z * inc; out.z = z;
    return out;
  }
  // (la ligne des nœuds, où l'orbite traverse le plan : à 90° de son point le plus haut)
  const n = (b.node || 0) - Math.PI / 2, cn = Math.cos(n), sn = Math.sin(n);
  const u = x * cn + z * sn, w = -x * sn + z * cn; // (le long de la ligne des nœuds, et en travers)
  const wh = w * Math.cos(b.incl);
  out.x = u * cn - wh * sn;
  out.z = u * sn + wh * cn;
  out.y = w * Math.sin(b.incl);
  return out;
}

// L'astre qui éclaire un corps : l'étoile ou le trou noir au sommet de ses orbites
export function sunOf(b) {
  while (b.kind !== 'star' && b.kind !== 'hole') b = BODY[b.parent];
  return b;
}
// L'astre qui éclaire le point p : l'étoile (ou le trou noir) la plus proche
export const LIGHTS = [STAR, ...BODIES.filter((b) => b.kind === 'star' || b.kind === 'hole')];
const nearest = (list, p, day, seed) => {
  let best = list[0], bd = Infinity;
  const q = { x: 0, y: 0, z: 0 };
  for (const b of list) {
    bodyPos(b.id, day, seed, q);
    const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
};
export function sunNear(p, day, seed) { return nearest(LIGHTS, p, day, seed); }
// Le système d'un astre : son astre central (Hexa, Érèbe, PXT-A), loin des autres
export const SYSTEMS = [STAR, ...BODIES.filter((b) => b.fixed)];
export function systemOf(b) {
  while (b.id !== 'star' && !b.fixed) b = BODY[b.parent];
  return b;
}
export function systemNear(p, day, seed) { return nearest(SYSTEMS, p, day, seed); }
// La rotation d'un astre en rotation synchrone (autour de y) : son point x = 0 face à son parent
export function spinAngle(b, day, seed) {
  return b.locked ? Math.PI - (phase(seed, b.id) + (Math.PI * 2 * day) / b.period) : 0;
}
// Hauteur de l'astre central vue du point (x, z) d'une planète synchrone : 1 au zénith (la face
// brûlante), 0 à l'horizon (le crépuscule), -1 à l'opposé (la nuit)
export function sunElev(b, x, z) {
  const span = spanOf(b), lon = -(x / span) * Math.PI * 2, lat = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, (-z / (span * 0.5)) * Math.PI));
  return Math.cos(lat) * Math.cos(lon);
}
// Température (°C) selon cette hauteur
const CLIMATE = [[-1, -160], [-0.2, -70], [-0.09, -28], [0, 16], [0.09, 58], [0.2, 180], [0.45, 700], [1, 1400]];
export function localTemp(e) {
  let i = 1;
  while (i < CLIMATE.length - 1 && e > CLIMATE[i][0]) i++;
  const [a, ta] = CLIMATE[i - 1], [b, tb] = CLIMATE[i];
  return ta + ((e - a) / (b - a)) * (tb - ta);
}
export const AIR_BAND = 0.09; // (l'air n'est respirable que dans cette bande, de part et d'autre du crépuscule)
// Gravité d'un trou noir (blocs/s²) à la distance d, pseudo-newtonienne (Paczyński-Wiita) : elle
// diverge à l'horizon, et la dernière orbite stable tombe à 3 rayons, comme dans la réalité
export const holeG = (b, d) => (b.c * b.c * b.R * 0.5) / Math.max(b.R * 0.01, d - b.R) ** 2;

// L'astre dont la sphère d'influence contient le point p (le plus petit) : 'star' sinon
export function soiAt(p, day, seed) {
  let best = 'star', bestR = Infinity;
  const q = { x: 0, y: 0, z: 0 };
  for (const b of BODIES) {
    bodyPos(b.id, day, seed, q);
    if (b.soi < bestR && (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2 < b.soi * b.soi) { best = b.id; bestR = b.soi; }
  }
  return best;
}
