import * as THREE from 'three';
import { buildAtlas } from './textures.js?v=1.1.5-alpha-mwgq2wrb';
import { World, FOG_NEAR, FOG_FAR } from './world.js?v=1.1.5-alpha-mwgq2wrb';
import { H, Y_MIN, CS } from './mesher.js?v=1.1.5-alpha-mwgq2wrb';
import { Industry } from './industry.js?v=1.1.5-alpha-mwgq2wrb';
import { LIQUID_OF_CAN, LIQUID_NAME, ROCKET_EQ, CAN_MB } from './liquids.js?v=1.1.5-alpha-mwgq2wrb';
import { WELDER, SEAL_DOOR, SEAL_DOOR_TOP } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { doorGroup, setDoor, otherAirlocks } from './doors.js?v=1.1.5-alpha-mwgq2wrb';
import { Player, EYE, SNEAK_DROP, RADIUS as PLAYER_RADIUS, HEIGHT as PLAYER_HEIGHT } from './player.js?v=1.1.5-alpha-mwgq2wrb';
import { BLOCKS, ITEMS, HOTBAR, AIR, HEXACART, GLUE, DOUBLE_GLUE, ROPE, GRAVITY_HAND, OPAQUE, ATTACHED, SLAB, SUPPORT, CRAFTING_TABLE, blockBox, TOGGLE, TORCH, ENERGY_TORCH, isRail, isTorch, isWater, isTnt, SNOWBALL, WRENCH, facingVariant, isPhysics, isWire, isLava, isIceWater, slabVariant, slabCombine, slabPartAt, setSecretItems, SOLID, FARMLAND, isFarmland, SNOW_LAYER, isSnowLayer, holdsSnow } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { OverlayFx } from './overlays.js?v=1.1.5-alpha-mwgq2wrb';
import { Weather } from './weather.js?v=1.1.5-alpha-mwgq2wrb';
import { Seasons, SEASON_DAYS } from './seasons.js?v=1.1.5-alpha-mwgq2wrb';
import { SnowCover } from './snow.js?v=1.1.5-alpha-mwgq2wrb';
import { Tornadoes } from './tornado.js?v=1.1.5-alpha-mwgq2wrb';
import { sea, WAVE_CALM, WAVE_STORM, MAX_TORNADOES } from './waves.js?v=1.1.5-alpha-mwgq2wrb';
import { setVolume, playToolBreak, playVillagerVoice, loadVillagerVoices, playStep, playBlip, playDoor, playAlarm } from './sound.js?v=1.1.5-alpha-mwgq2wrb';
import { fireSound } from './ambience.js?v=1.1.5-alpha-mwgq2wrb';
import { playBreak, playDig, playPlace, playEat, playPickup, playHurt, playDeath, playSplash, playHit, playAnimal, hasVoice, playChest, playCraft, playClick, playClack, playHorn, playWhistle, playChime, engineSound, playHorn2, playChuff, playCannon, playCough } from './sfx.js?v=1.1.5-alpha-mwgq2wrb';
import { playMusic, stopMusic, playSting, musicDirector } from './music.js?v=1.1.5-alpha-mwgq2wrb';
import { GameFx } from './fx.js?v=1.1.5-alpha-mwgq2wrb';
import { TrainSystem, LOCOMOTIVE, WAGON, TRAIN_FUEL, FUEL_MAX, ELEC_FUEL, PART_SLOTS, isSteam, SHELL, locoOf, putIn, STYLES, itemOfCar } from './trains.js?v=1.1.5-alpha-mwgq2wrb';
import { TrackSystem, isTrack, axisOf, TRACK_IDS, LINE_MATS } from './tracks.js?v=1.1.5-alpha-mwgq2wrb';
import { Tutorial } from './tutorial.js?v=1.1.5-alpha-mwgq2wrb';
import { Progress, ADVICE_LEVELS, TIERS } from './progress.js?v=1.1.5-alpha-mwgq2wrb';
import { playEnding } from './ending.js?v=1.1.5-alpha-mwgq2wrb';
import { LensFlare } from './lensflare.js?v=1.1.5-alpha-mwgq2wrb';
import { CLOUD_Y } from './clouds.js?v=1.1.5-alpha-mwgq2wrb';
import { INV_TABS, invCategory, invSort } from './invcats.js?v=1.1.5-alpha-mwgq2wrb';
import * as Controls from './controls.js?v=1.1.5-alpha-mwgq2wrb';
import { createTouch, touchDevice } from './touch.js?v=1.1.5-alpha-mwgq2wrb';
import { createGamepad } from './gamepad.js?v=1.1.5-alpha-mwgq2wrb';
import { Hexaliens } from './hexaliens.js?v=1.1.5-alpha-mwgq2wrb';
import { LANG, LANGS, startPageTranslation } from './i18n.js?v=1.1.5-alpha-mwgq2wrb';
startPageTranslation(); // (en anglais : les textes de la page sont traduits au fil de l'eau)
import { playDeparture } from './departure.js?v=1.1.5-alpha-mwgq2wrb';
import { CartonSystem, countOf } from './cartons.js?v=1.1.5-alpha-mwgq2wrb';
import { Y0 as STATION_Y, SPOTS as STATION_SPOTS } from './station.js?v=1.1.5-alpha-mwgq2wrb';
import { PHRASES, PHRASE_KEYS } from './villagetalk.js?v=1.1.5-alpha-mwgq2wrb';
import { RopeSystem, ROPE_MAX } from './ropes.js?v=1.1.5-alpha-mwgq2wrb';
import { TntSystem } from './tnt.js?v=1.1.5-alpha-mwgq2wrb';
import { StructSystem, PHYS_DEFAULT, gravRoute, validGrav, ROUTE_MAX } from './structs.js?v=1.1.5-alpha-mwgq2wrb';
import { Rockets, SPACE_Y } from './rocket.js?v=1.1.5-alpha-mwgq2wrb';
import { SpaceFlight, ruinRel } from './spaceflight.js?v=1.1.5-alpha-mwgq2wrb';
import { SystemView } from './skyview.js?v=1.1.5-alpha-mwgq2wrb';
import { ZONE, bodyZone, zoneBody, slotAt, zoneOfXZ, LAND_IDS, localOrigin } from './spacegen.js?v=1.1.5-alpha-mwgq2wrb';
import { dirToWorld } from './planetview.js?v=1.1.5-alpha-mwgq2wrb';
import { BODY, spanOf, sunOf, systemOf, sunElev, localTemp, AIR_BAND, bodyPos } from './system.js?v=1.1.5-alpha-mwgq2wrb';
import { TEAMS, teamOf } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { GRAVITRON, hasParams, WALL_TORCH, TARGET, isStation, isProp, CONDUCTOR_CAP, compOf, STEAM_PART, CAMERA, PHOTO_PAPER, PHOTO, PHOTO_FRAME, isPhotoFrame } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { STRUCTURE_BLOCK, MAX_SIZE, store as structStore, validName as validStructName, regionCells, capture, placement, place as placeStructure, RegionPreview } from './structures.js?v=1.1.5-alpha-mwgq2wrb';
import { SnowballSystem } from './snowballs.js?v=1.1.5-alpha-mwgq2wrb';
import { Weapons, GUNS, TURRETS } from './weapons.js?v=1.1.5-alpha-mwgq2wrb';
import { Containers, empty as emptyBox } from './containers.js?v=1.1.5-alpha-mwgq2wrb';
import { Circuits } from './circuits.js?v=1.1.5-alpha-mwgq2wrb';
import { RadioTags } from './radiotags.js?v=1.1.5-alpha-mwgq2wrb';
import { Nature } from './nature.js?v=1.1.5-alpha-mwgq2wrb';
import { Items, FirstPersonHand } from './held.js?v=1.1.5-alpha-mwgq2wrb';
import { CartSystem } from './carts.js?v=1.1.5-alpha-mwgq2wrb';
import { CORNERS, NEIGHBORS, hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mwgq2wrb';
import { randomSeed, BIOME, BIOME_NAMES, BIOME_COLORS, GEN_LATEST, FLAT_LOW, FLAT_DEEP, Generator } from './gen.js?v=1.1.5-alpha-mwgq2wrb';
import { WorldMap } from './map.js?v=1.1.5-alpha-mwgq2wrb';
import { Survival, MAX_HEALTH, breakTime, dropOf, extraDrop, stackMax, wearBar, matterOf } from './survival.js?v=1.1.5-alpha-mwgq2wrb';
import { Sky, DAY_LENGTH, clockText, MOON_PHASE_NAMES } from './sky.js?v=1.1.5-alpha-mwgq2wrb';
import * as Save from './save.js?v=1.1.5-alpha-mwgq2wrb';
import { Net, GAME_VERSION, NAME_RE, helpLines, COMMANDS } from './net.js?v=1.1.5-alpha-mwgq2wrb';
import { Commands, COMMAND_RE } from './commands.js?v=1.1.5-alpha-mwgq2wrb';
import { Wiki } from './wiki.js?v=1.1.5-alpha-mwgq2wrb';
import { RECIPES } from './survival.js?v=1.1.5-alpha-mwgq2wrb';
import { SMELT, FUEL } from './containers.js?v=1.1.5-alpha-mwgq2wrb';
import { PRESS_MAX } from './climate.js?v=1.1.5-alpha-mwgq2wrb';
import { AnimalSystem, attackDamage, SPECIES } from './animals.js?v=1.1.5-alpha-mwgq2wrb';
import { JOBS, JOB_TRADES, BUILDS } from './colony.js?v=1.1.5-alpha-mwgq2wrb';
import { playIntro, wreckPlan, shipBlocks } from './intro.js?v=1.1.5-alpha-mwgq2wrb';
import { playCrash, wakeScreen, rotHex, planPod, playPod } from './crash.js?v=1.1.5-alpha-mwgq2wrb';
import { isBelt, isShaft, BELT, CHEST, COOKED_PORK, IRON_INGOT, COAL, makeSlot, LEVER, LEVER_ON, POD, POD_TOP, isPod, MINE_WAGON, HELMET_LAMP, BREAD, FLUORITE_INGOT, PLATINUM_INGOT, VOLTITE } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { Account, ACHIEVEMENTS, ACH_CATS, COLORS, levelOf, xpFor } from './account.js?v=1.1.5-alpha-mwgq2wrb';
import { initSocial, bannerEl, tagEl } from './social.js?v=1.1.5-alpha-mwgq2wrb';
import { Voice, VOICE_MODES } from './voice.js?v=1.1.5-alpha-mwgq2wrb';
import { loadSkins, skins, skinsFor, skinFile, skinUrl } from './skins.js?v=1.1.5-alpha-mwgq2wrb';
import { SkinView } from './skinview.js?v=1.1.5-alpha-mwgq2wrb';
import { setCharacterStyle } from './character.js?v=1.1.5-alpha-mwgq2wrb';
import { initOrigin, followOrigin, onRebase, ORIGIN, PERIOD } from './origin.js?v=1.1.5-alpha-mwgq2wrb';
import { Orbital } from './orbital.js?v=1.1.5-alpha-mwgq2wrb';
import { ShipFrame } from './shipframe.js?v=1.1.5-alpha-mwgq2wrb';
import { LORE_ITEM, loreDoc } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { BEACON, SCHEMATIC, isRadio, NEDROLYTIUM, TUNGSTEN_INGOT, CANISTER, FUEL_CANISTER, CREATIVE_CANISTER, COCKPIT, PASSENGER_SEAT, SPACE_HELMET } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { Schematics } from './schematics.js?v=1.1.5-alpha-mwgq2wrb';
import { REACTOR, PROPELLER_ON, isPropeller, ANALOG, isAnalog, isWheel, isCarSeat, isRoutePilot } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { CAR_VMAX } from './cars.js?v=1.1.5-alpha-mwgq2wrb';
import { Photos } from './photos.js?v=1.1.5-alpha-mwgq2wrb';
import { LORE, CORRUPTED, loreHtml } from './lore.js?v=1.1.5-alpha-mwgq2wrb';
import { CartLoads } from './cartloads.js?v=1.1.5-alpha-mwgq2wrb';
import { CRATER_STONE } from './biomes.js?v=1.1.5-alpha-mwgq2wrb';
import { METAL } from './metals.js?v=1.1.5-alpha-mwgq2wrb';

const REACH = 6;
const account = new Account(); // compte en ligne (voir plus bas et account.js)
// Succès désactivés : dans un monde qui est passé en créatif, ou quand on joue en créatif (un
// joueur qui a rejoint une partie en créatif)
account.blocked = () => state !== 'menu' && (!!current?.cheated || !survival.on);
const voice = new Voice();     // chat vocal de proximité (voir voice.js)
const skinView = new SkinView(document.getElementById('skin-view')); // aperçu de la skin (écran titre)
const AUTOSAVE_MS = 15000;
const TITLE_SEED = 'hexacraft';
const SPLASHES = [
  'En hexagones !', '6 côtés, c\'est mieux que 4 !', 'Pas un seul cube !', 'Approuvé par les abeilles !',
  'Fait maison !', 'Génération procédurale !', 'Aussi en 3D !', 'Le tronc est rond… presque !',
];

// ---------- Rendu ----------
// Anticrénelage : coûteux pour les petites cartes graphiques ; désactivé en qualité "Bas"
// (lu avant tout le reste : il ne peut être choisi qu'à la création du rendu)
const savedQuality = (() => { try { return JSON.parse(localStorage.getItem('hexacraft.options'))?.quality; } catch { return null; } })();
const renderer = new THREE.WebGLRenderer({ antialias: savedQuality !== 0, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
document.getElementById('game').appendChild(renderer.domElement);
const canvas = renderer.domElement;
// La carte graphique a lâché (mémoire pleine, trop de travail) : three.js reprend tout seul
// quand le navigateur rend la main ; on baisse la distance d'affichage pour que ça ne recommence
// pas (sinon l'écran restait blanc)
let gpuLost = false;
canvas.addEventListener('webglcontextlost', () => {
  gpuLost = true;
  if (options.dist > 256) {
    options.dist = Math.max(256, Math.round((options.dist * 0.6) / 32) * 32);
    saveOptions();
  }
});
canvas.addEventListener('webglcontextrestored', () => {
  if (!gpuLost) return;
  gpuLost = false;
  world.remeshAll(); // (sommets du terrain libérés après l'envoi : on les refait)
  applyOptions();
  sky.needsShadow = true;
  toast(`La carte graphique était saturée : distance d'affichage réduite à ${options.dist} blocs`);
});

// Ombres : recalculées seulement quand c'est utile (voir Sky et la boucle)
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9ccfff, 35, 60);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 450);
camera.rotation.order = 'YXZ';
// origine flottante : la carte graphique ne voit que des positions proches de la caméra, aussi
// loin qu'on aille (voir origin.js)
initOrigin(scene, camera);

const sky = new Sky(scene);
// les astres du système dans le ciel (voir skyview.js) : couleurs d'après leur vrai terrain
sky.view = new SystemView((b, seed) => planetSample(b, seed));
// Le fond (ciel, étoiles, soleil, puis les astres) est dessiné d'abord, à part (voir frame) : les
// astres y ont leur vraie profondeur, et tout le reste du monde passe ensuite par-dessus.
const SKY_LAYER = 1;
sky.dome.layers.set(SKY_LAYER);
sky.group.traverse((o) => o.layers.set(SKY_LAYER));
// (l'origine a changé : ombres à refaire, motif des vagues décalé comme celui du shader)
onRebase((o) => {
  sky.shadowKey = '';
  sky.needsShadow = true;
  sea.ox = Math.floor(o.x / PERIOD) * PERIOD;
  sea.oz = Math.floor(o.z / PERIOD) * PERIOD;
});
let dayTime = 0.05; // heure du jour : 0 = lever du soleil
let dayCount = 0;   // numéro du jour (phases de la lune)
let timeLock = null; // jour / nuit éternels (/time) : l'heure qui ne bouge plus, ou null
function advanceTime(dt) {
  if (timeLock !== null) { dayTime = timeLock; sky.setDay(dayCount); return; }
  // (près d'un trou noir, le temps passe plus vite pour le reste de l'univers : voir spaceflight.holeFx)
  dayTime += (dt * (flight.dilation || 1)) / DAY_LENGTH;
  // (près d'un trou noir, des jours entiers peuvent passer en une image)
  if (dayTime >= 1) {
    const n = Math.floor(dayTime);
    dayTime -= n;
    // (sans les messages du matin, des saisons : ils défileraient à chaque image)
    if (n === 1 && (flight.dilation || 1) < 50) newDay(); else dayCount += n;
  }
  sky.setDay(dayCount);
}
function newDay() {
  dayCount++;
  // (succès : une nuit de plus survécue en survie)
  if (current && survival.on && state !== 'menu' && state !== 'dead') {
    const days = account.bump('nights');
    if (days >= 7) account.unlock('survivant');
    for (const d of [10, 100, 250, 500, 1000, 2500, 10000]) if (days >= d) account.unlock('jours' + d);
  }
}

// ---------- Dormir dans un lit de villageois ----------
// Clic droit sur un lit, la nuit : on s'y couche (au fond, tourné vers l'ouverture), l'écran
// s'assombrit et l'on se réveille au lever du soleil du jour suivant. Pas avec des monstres
// tout près ; en multijoueur, seul l'hôte fait passer la nuit.
const SLEEP_FADE = 1.6, SLEEP_HOLD = 1.2, MONSTER_R = 10;
let sleep = null;
const sleepEl = Object.assign(document.createElement('div'), { id: 'sleep-overlay' });
sleepEl.textContent = 'Zzz…';
document.body.appendChild(sleepEl);
const isNight = () => dayTime >= 0.5 && dayTime < 0.98;
// (s : le lit est sur un objet physique ; q, r, y dans sa grille)
function sleepInPod(q, r, y, s = null) {
  const b = BLOCKS[s ? s.blocks.get(q + ',' + r + ',' + y) : world.getBlock(q, r, y)];
  if (b?.pod === undefined) return;
  const by = b.podTop ? y - 1 : y;
  if (!isNight()) { toast('Tu ne peux dormir que la nuit'); return; }
  if (net.isClient) { toast('En multijoueur, seul l\'hôte peut faire passer la nuit'); return; }
  if (animals.list.some((a) => a.active && !a.dead && SPECIES[a.type].hostile && a.pos.distanceTo(player.pos) < MONSTER_R)) {
    toast('Tu ne peux pas dormir : des monstres rôdent tout près');
    return;
  }
  // couché dans le lit (au centre de la case du bas), face à l'ouverture
  const c = hexToWorld(q, r), [nq, nr] = NEIGHBORS[b.pod], o = hexToWorld(q + nq, r + nr);
  player.pos.set(c.x, by + 0.01, c.z);
  if (s) {
    // (dans le repère de l'objet : le lit et son ouverture ramenés dans le monde)
    structs.toWorld(s, new THREE.Vector3(c.x, by + 0.01, c.z), player.pos);
    const ow = structs.toWorld(s, new THREE.Vector3(o.x, by, o.z), new THREE.Vector3());
    o.x = ow.x; o.z = ow.z; c.x = player.pos.x; c.z = player.pos.z;
  }
  player.vel.set(0, 0, 0);
  player.fly = false;
  player.yaw = Math.atan2(-(o.x - c.x), -(o.z - c.z));
  player.pitch = 0;
  sleep = { t: 0, done: false };
  keys.clear();
  sleepEl.classList.add('on');
}
function tickSleep(dt) {
  sleep.t += dt;
  keys.clear();
  player.vel.set(0, 0, 0);
  if (!sleep.done && sleep.t >= SLEEP_FADE + SLEEP_HOLD * 0.5) {
    // le matin du jour suivant
    sleep.done = true;
    if (dayTime >= 0.5) newDay();
    dayTime = 0.02;
    sky.setDay(dayCount);
    world.changed = true;
    account.unlock('dodo');
  }
  if (sleep.t >= SLEEP_FADE + SLEEP_HOLD) {
    sleepEl.classList.remove('on');
    sleep = null;
    toast('Bonjour ! Une nouvelle journée commence');
  }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  stillDrawn = false; // (le canevas est effacé : on redessine l'image figée)
});
// Menu ouvert en solo (inventaire, craft, coffre) : le monde est à l'arrêt derrière, on
// garde la dernière image au lieu de le redessiner à chaque fois (voir la boucle)
let stillDrawn = false;

// ---------- Monde & joueur ----------
const atlas = await buildAtlas();
atlas.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
document.documentElement.style.setProperty('--dirt', `url(${atlas.tiles.dirt.toDataURL()})`);
const world = new World(scene, atlas);
// pluie, neige, orages (voir weather.js)
const weather = new Weather(scene, world, sky.clouds);
// saisons : feuillage, neige au sol, température, météo (voir seasons.js)
const seasons = new Seasons(scene, world, atlas.seasonMask);
// couches de neige au sol, qui tombent et fondent (voir snow.js)
const snowCover = new SnowCover(world, seasons);
const tornadoes = new Tornadoes(scene, world, sky.clouds);
// (un chunk refait : les ombres suivent, mais pas plus souvent que le réglage de qualité)
let meshShadow = false;
world.onMeshChange = () => { meshShadow = true; };
// effets visuels (éclats, poussière, éclaboussures, étincelles : voir fx.js). Les particules
// rebondissent sur le premier bloc plein sous elles
const fx = new GameFx(scene, atlas, (x, y, z) => {
  const { q, r } = worldToHex(x, z);
  for (let k = Math.floor(y); k > y - 8; k--) if (SOLID[world.getBlock(q, r, k)]) return k + 1;
  return -Infinity;
});
// l'ombre des nuages passe sur le terrain et les rails (voir clouds.js)
for (const m of [world.material, world.railMaterial]) {
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { base(sh, r); sky.clouds.patch(sh); if (m === world.material) seasons.patch(sh); };
}
const player = new Player(world);
Object.defineProperty(player, 'pseudo', { get: () => options.pseudo }); // (les militaires suivent leur chef)
const carts = new CartSystem(scene, world);
// trains (locomotive et wagons sur les rails, voir trains.js)
// voies du train (nœuds, lignes droites, grands virages : voir tracks.js), et les trains
const tracks = new TrackSystem(scene, world);
// schématiques : les projections (blocs fantômes) ; leur couleur, celle de la texture du bloc
const blockColors = new Map();
function blockColor(id) {
  if (blockColors.has(id)) return blockColors.get(id);
  let col = '#9ad8f0';
  try {
    const t = atlas.tiles[BLOCKS[id]?.side] || atlas.tiles[BLOCKS[id]?.top];
    const d = t.getContext('2d').getImageData(0, 0, t.width, t.height).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 128) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    if (n) col = `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
  } catch { /* (couleur par défaut) */ }
  blockColors.set(id, col);
  return col;
}
const schem = new Schematics(scene, world, blockColor);
const photos = new Photos(scene); // (photos prises et accrochées aux murs, voir photos.js)
world.onAnySet = (q, r, y, id, old) => {
  if (isPhotoFrame(old) && !isPhotoFrame(id)) photos.unhang(q + ',' + r + ',' + y);
  tracks.onBlock(q, r, y, id, old);
  industry?.onBlock(q, r, y, id, old);
  orbital?.onBlock(q, r, y, id, old);
  schem.onWorldSet(q, r, y);
  // gâteau chauffant posé / retiré (voir seasons.js)
  if (BLOCKS[id]?.heater || BLOCKS[old]?.heater) seasons.setHeater(q, r, y, !!BLOCKS[id]?.heater);
};
const trains = new TrainSystem(scene, world, tracks);
// (un train dont la voie a disparu : ses voitures reviennent dans l'inventaire)
trains.onLost = (stacks, at) => { giveBack(stacks, at); toast("Un train a perdu sa voie : il revient dans l'inventaire"); };
// (objets rendus : dans l'inventaire en survie, le reste dans un carton à cet endroit)
function giveBack(stacks, at) {
  if (!survival.on) return;
  const left = [];
  for (const st of stacks) { const n = survival.give(st.id, st.n, st.w || 0); if (n) left.push({ ...st, n }); }
  if (left.length && at) { spawnCarton(at.clone().add(new THREE.Vector3(0, 1, 0)), left, null, 1.5); toast('Inventaire plein : le reste tombe dans un carton'); }
}
trains.onClack = (pos, v) => playClack(pos.distanceTo(player.pos), v);
// fumée de la locomotive, étincelles des roues au freinage (voir trains.effects)
trains.onSmoke = (p, v, s, kind) => {
  if (kind === 'steam') fx.puffs.spawn(p, v, 2.6 + Math.random() * 1.6, Math.random() < 0.55 ? '#5c5c60' : '#9a9a9e', 0.45 * s, 1.9 * s, 0.75, 0.45);
  else if (kind === 'jet') fx.puffs.spawn(p, v, 0.7 + Math.random() * 0.4, '#f2f4f6', 0.3 * s, 1.2 * s, 0.6, 0.7);
  else fx.puffs.spawn(p, v, 2 + Math.random() * 1.2, Math.random() < 0.5 ? '#8f8f8f' : '#b5b5b5', 0.3 * s, 1.3 * s, 0.7, 0.5);
};
// wagon blindé : le coup de canon (fumée à la bouche, son) ; l'obus explose comme une TNT
trains.onFire = (p, dir) => {
  playCannon(p.distanceTo(player.pos));
  for (let i = 0; i < 6; i++) fx.puffs.spawn(p.clone(), dir.clone().multiplyScalar(4 + Math.random() * 4).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.5 + Math.random(), (Math.random() - 0.5) * 2)), 1.2 + Math.random(), '#9a9a9e', 0.5, 1.8, 0.7, 0.5);
};
trains.onShellHit = (x, y, z) => tnt.explode(x, y - 0.5, z, { player, carts, listener });
// (vapeur : le « tchou » de chaque bouffée, plus fort près de la locomotive)
trains.onChuff = (c, effort) => playChuff(c.pos.distanceTo(player.pos), effort);
trains.onSparks = (p, v) => fx.glow.spawn(p, v, 0.2 + Math.random() * 0.25, Math.random() < 0.5 ? '#ffd27a' : '#ff9a3c', 0.05, 0, 1.2, -9);
// (à bord de ce train, ou tout près : les messages du train nous concernent)
const aboard = (t) => player.riding?.train === t;
const nearTrain = (t, d = 32) => aboard(t) || t.cars.some((c) => c.pos.distanceTo(player.pos) < d);
trains.onStop = (t, st) => {
  playWhistle(t.cars[0].pos.distanceTo(player.pos));
  if (aboard(t)) account.unlock('terminus');
  travelStop(t, st);
};
trains.onDepart = (t) => playWhistle(t.cars[0].pos.distanceTo(player.pos));
trains.onNoFuel = (t) => { if (aboard(t)) toast('Plus de combustible : clic droit sur la locomotive avec du charbon ou du bois'); };
trains.onAutoOff = (t) => { if (aboard(t)) toast('Pilote automatique coupé'); };
trains.onNoRails = (t) => { if (nearTrain(t)) toast('Le wagon poseur n\'a plus de rails de train'); };
trains.onNoBallast = (t) => { if (nearTrain(t)) toast('Le wagon poseur n\'a plus de gravier (ou de pierre) pour combler le vide sous la voie'); };
trains.onBlocked = (t) => { if (nearTrain(t)) toast('Le wagon poseur est bloqué : un bloc incassable devant'); };
// (deux trains automatiques face à face sur une voie unique, sans aiguillage où s'écarter)
trains.onParked = (t, o) => { if (nearTrain(t, 96) || nearTrain(o, 96)) toast("Un train garé sans conducteur bloque la voie d'un train en pilote automatique : déplace-le ou mets-le en pilote automatique"); };
trains.onDeadlock = (t, o) => { if (nearTrain(t, 96) || nearTrain(o, 96)) toast("Deux trains sont face à face sur une voie unique sans aiguillage pour se croiser : ajoute une voie d'évitement (deux aiguillages)"); };
trains.onLay = (c) => {
  if (c.distanceTo(player.pos) < 28) playPlace('rail');
  if (c.distanceTo(player.pos) < 64 && account.bump('rails_poses') >= 100) account.unlock('poseur');
};
trains.onPickup = (p) => { if (p.distanceTo(player.pos) < 64) account.unlock('tremie'); };
trains.onDetect = (d) => { if (d.pos.distanceTo(player.pos) < 64) account.unlock('detecteur'); };
await carts.init();
const tnt = new TntSystem(scene, world);
// position de l'oreille du joueur (volume des sons)
const listener = new THREE.Vector3();
// coffres et fours : contenu de chaque bloc (voir containers.js)
const containers = new Containers(world); // (relié aux objets physiques plus bas)
const cartons = new CartonSystem(scene, world); // objets jetés, rangés dans des cartons (voir cartons.js)
// circuits de voltite (voir circuits.js) : une TNT alimentée s'allume
const circuits = new Circuits(world);
tracks.powered = (q, r, y) => circuits.powered(q, r, y); // (un signal qui reçoit du courant passe au rouge)
circuits.onIgnite = (q, r, y) => tnt.ignite(q, r, y, null, listener);
// Foudre (voir weather.js) : elle tombe sur le plus haut bloc. Une TNT frappée s'allume ; un
// joueur tout près, dehors, est foudroyé (et prend feu)
weather.onStrike = (q, r, top, x, z) => {
  if (!net.isClient && isTnt(world.getBlock(q, r, top - 1))) tnt.ignite(q, r, top - 1, null, listener);
  if (state === 'menu' || !survival.on || survival.dead || player.inWater) return;
  if (Math.hypot(player.pos.x - x, player.pos.z - z) < 2.2 && player.pos.y > top - 1.5) {
    survival.damage(6);
    burnLeft = BURN_AFTER;
    toast('Foudroyé !');
  }
};
// Pluie d'astéroïdes (voir weather.js) : le météore explose en touchant le sol et laisse un petit
// cratère tapissé de pierre de cratère, avec au fond un minerai rare venu de l'espace (iridium,
// gravitite, titane ou uranite). Les blocs : chez l'hôte (ou en solo) seulement, les clients les reçoivent.
weather.onImpact = (q, r, top, x, z) => {
  tnt.explode(x, top, z, { player, carts, listener });
  if (net.isClient) return;
  const prizes = [METAL.iridium.ore, METAL.gravitite.ore, METAL.titane.ore, METAL.uranite.ore];
  const prize = prizes[Math.floor(Math.random() * prizes.length)];
  for (let dq = -4; dq <= 4; dq++) {
    for (let dr = -4; dr <= 4; dr++) {
      const d = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
      if (d > 4) continue;
      // (le premier bloc solide en descendant : le fond ou le bord du cratère)
      for (let y = top + 3; y > top - 9; y--) {
        const id = world.getBlock(q + dq, r + dr, y);
        if (!id || !SOLID[id] || BLOCKS[id]?.unbreakable) continue;
        if (d === 0) world.setBlock(q, r, y, prize);
        else if (Math.random() < (d <= 2 ? 0.95 : 0.55)) world.setBlock(q + dq, r + dr, y, CRATER_STONE);
        break;
      }
    }
  }
};
weather.onMeteorTrail = (x, y, z) => { if (Math.random() < 0.7) fx.sparkle(x, y, z); };
// feuilles qui disparaissent, pousses, herbe (voir nature.js)
const nature = new Nature(world, scene);
// (les plantes poussent selon la température de la saison ; très lentement quand il gèle)
nature.growthAt = (q, r, y) => { const { x, z } = hexToWorld(q, r); return Math.max(0.08, seasons.growth(seasons.tempAt(x, y, z))); };
world.afterSet = (q, r, y, id, old) => {
  tnt.onBlockSet(q, r, y, id, listener);
  nature.onBlockSet(q, r, y, id, old);
  structs.onWorldSet(q, r, y);
  containers.onBlockSet(q, r, y, id);
  circuits.onBlockSet(q, r, y);
  if (!hasParams(id)) structs.worldParams.delete(q + ',' + r + ',' + y); // bloc physique ou gravitron cassé
  if (id === TARGET && old !== TARGET) addTarget(q + ',' + r + ',' + y);
  else if (old === TARGET && id !== TARGET) targetNames.delete(q + ',' + r + ',' + y);
};
// Blocs cibles du monde : "q,r,y" -> nom (réglé à la clé à molette), choisis comme destination
// dans le gravitron
let targetNames = new Map();
function addTarget(k) {
  if (targetNames.has(k)) return;
  const used = new Set(targetNames.values());
  let n = 1;
  while (used.has('Cible ' + n)) n++;
  targetNames.set(k, 'Cible ' + n);
}
// (hôte) les noms des cibles, aux invités (le gravitron les propose)
function shareTargets() { if (net.isHost) net.broadcastJoined({ t: 'tgts', l: [...targetNames] }); }
// Position (F3) visée pour une cible : juste au-dessus du bloc
function targetPos(k) {
  const [q, r, y] = k.split(',').map(Number), c = hexToWorld(q, r);
  return [Math.round(c.x), y + 1, Math.round(c.z)];
}
// objets collés (Super colle) ; les explosions les projettent
const structs = new StructSystem(scene, world);
// fusées : les objets collés qui ont des tuyères (voir rocket.js)
const rockets = new Rockets(scene, structs);
rockets.onSmoke = (p, v, air) => {
  if (performance.now() - lastFrameAt > 250) return;
  if (Math.random() < 0.5) fx.puffs.spawn(p.clone(), v.clone().multiplyScalar(0.6), 0.25 + Math.random() * 0.2, Math.random() < 0.5 ? '#ffb040' : '#ffe080', 0.5, 1.2, 0.3, 0);
  if (air > 0.05) fx.puffs.spawn(p.clone(), v.clone().multiplyScalar(0.35), 2 + Math.random() * 2, Math.random() < 0.5 ? '#c8c8cc' : '#a0a0a6', 0.8, 3.5 * air + 1, 0.8, 0.2);
};
// les trains : plateaux des wagons plats et chocs contre les objets (voir trains.js)
trains.structs = structs;
// (trémies : les cartons qu'elles ramassent, les coffres où elles se vident ; survie : le combustible)
trains.cartons = cartons;
trains.containers = containers;
trains.fuelOn = () => survival.on;
// un aiguillage touché par du courant suit le courant (voir tracks.power)
circuits.onTrackPower = (q, r, y, on) => tracks.power(q, r, y, on);
tracks.onSwitch = (n) => { if (n.pos.distanceTo(player.pos) < 64) account.unlock('poste_aiguillage'); };
trains.onCrash = (pos, speed) => { const d = pos.distanceTo(player.pos); playHit(d); playBreak('hard', d); if (d < 48) account.unlock('accident'); };
// en ligne : l'hôte envoie les tronçons (virages, longues lignes, aiguillages) quand ils changent
// (d : un seul panneau, aiguillage ou nom qui change ; sans d : tout le réseau)
tracks.onChange = (d) => { if (net.active && !net.isClient) net.broadcastJoined(d ? { t: 'trd', ...d } : { t: 'trk', d: tracks.serialize() }); };
// (les coffres des wagons : « T<numéro du wagon> », voir containers.byKey)
containers.trainBox = (id) => trains.byId(id)?.box || null;
// (un wagon plat enlevé : le contenu des coffres posés sur son plateau revient aussi)
trains.onDeckGone = (d) => {
  const out = [];
  for (const [q, r, y, id] of d.list) if (BLOCKS[id]?.container) out.push(...containers.takeKey('S' + d.id + ':' + q + ',' + r + ',' + y));
  if (player.attached === d) player.attached = player.standingOn = null;
  return out;
};
const ropes = new RopeSystem(scene, world, structs); // cordes (voir ropes.js)
// lumière des objets collés : sources proches du monde et des objets (voir structs.relight)
structs.lightSources = (x, z, R) => world.lightsNear(x, z, 64, R).concat(structs.lightsNear(x, z, R));
containers.structs = structs;
structs.onMoveBox = (from, to) => containers.move(from, to); // le contenu des coffres et fours suit les objets physiques
structs.carts = carts; // collisions Hexacarts / objets collés
// animaux (le cochon) : chargés plus bas (texture)
const animals = new AnimalSystem(scene, world);
// les Hexaliens des grottes souterraines (voir hexaliens.js)
const hexaliens = new Hexaliens(scene, world);
// rails des mines abandonnées arrivés avec leur chunk (voir world.adoptRails) : le réseau change
world.onRailsAdopted = (k) => tracks.adopted(k);
// assembleur de chariot : les chargements des Hexacarts (voir cartloads.js)
const cartLoads = new CartLoads(carts, structs, world, circuits);
// un animal frappé (par le joueur, un garde, une explosion...) : son cri, des éclats ; mort, un
// petit nuage
animals.onHurt = (a) => {
  const d = a.pos.distanceTo(player.pos);
  if (d > 48) return;
  playHit(d);
  if (hasVoice(a.type)) playAnimal(a.type, d, true);
  fx.hit(a.pos.x, a.pos.y + 0.8, a.pos.z);
  if (a.dead) fx.poof(a.pos.x, a.pos.y, a.pos.z);
};
// cris des animaux autour du joueur, de temps en temps (les zombies grognent plus souvent)
let cryClock = 0;
function animalCries(dt) {
  if ((cryClock -= dt) > 0) return;
  cryClock = 0.5;
  for (const a of animals.list) {
    if (a.dead || !hasVoice(a.type)) continue;
    const d = Math.abs(a.pos.x - player.pos.x) + Math.abs(a.pos.z - player.pos.z);
    if (d > 32) continue;
    if (Math.random() < (a.type === 'zombie' ? 0.03 : 0.008)) playAnimal(a.type, a.pos.distanceTo(player.pos));
  }
}
// villageois : ils parlent (on les entend), se souviennent des joueurs (voir villagetalk.js)
animals.talk.time = () => dayTime;
animals.colony.containers = containers; // (le coffre de la mairie, ceux des maisons : voir colony.js)
animals.colony.structs = structs; // (véhicules du mécanicien)
animals.structs = structs; // (le chauffeur de taxi assis dans son véhicule)
animals.colony.day = () => dayCount; // (le village grandit avec les jours : grands immeubles)
// (bloc cible d'une plateforme de lancement : un nom à lui, unique)
animals.colony.nameTarget = (k, name) => {
  addTarget(k);
  const used = new Set([...targetNames].filter(([kk]) => kk !== k).map(([, n]) => n));
  let n = name, i = 2;
  while (used.has(n)) n = name + ' ' + i++;
  targetNames.set(k, n);
  world.changed = true;
};
animals.talk.nameOf = (p) => (p === player ? options.pseudo : net.proxyName(p));
animals.talk.onSay = (a, k) => { villagerVoice(a, k); net.villagerSaid(a, k); };
// zombies : ils poursuivent et mordent les joueurs en survie (un joueur distant : l'hôte le
// lui fait savoir, il décide lui-même s'il est en survie)
animals.canPrey = (p) => (p === player ? survival.on && !survival.dead && state !== 'dead' : true);
// (succès : une naissance, un garde qui tue un zombie, sous les yeux du joueur)
animals.colony.onEvent = (k, x, z) => { if (Math.hypot(x - player.pos.x, z - player.pos.z) < 32) account.unlock(k === 'birth' ? 'naissance' : 'garde'); };
animals.onBite = (p, d, x, z, a) => { if (p === player) hurtSelf(d, x, z, (a && SPECIES[a.type]?.by) || 'un zombie'); else net.mobHit(p, d, x, z); };
function villagerVoice(a, k) {
  if (state === 'menu') return;
  loadVillagerVoices(PHRASE_KEYS); // (partie rejointe : chargées au premier mot)
  playVillagerVoice(k, PHRASES[k][0], camera.position.distanceTo(a.pos), a.type === 'villager_child');
}
tnt.onPush = (x, y, z, R, strength) => { structs.explode(x, y, z, R, strength, weapons.protects(x, y, z)); animals.explode(x, y, z, R); };
// TNT d'un objet physique allumée (torche, courant, explosion, missile) : elle s'en détache
structs.onTnt = (x, y, z, vel, block, fuse) => tnt.launch(x, y, z, vel, block, fuse, listener);
tnt.structs = structs; // les TNT allumées se cognent aux objets physiques
// survie : une explosion blesse le joueur local (chez chaque joueur, en ligne aussi)
tnt.onBoom = (center, R, big) => { if (state !== 'menu' && state !== 'dead') survival.explosion(center, R, big, player); };
// Recadre une image sur sa partie non transparente (icônes avec de grandes marges)
function cropImage(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (d[(y * c.width + x) * 4 + 3] < 16) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return img;
  const side = Math.max(x1 - x0, y1 - y0) + 1; // carré centré sur le dessin
  const out = document.createElement('canvas');
  out.width = out.height = side;
  out.getContext('2d').drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, (side - (x1 - x0 + 1)) / 2, (side - (y1 - y0 + 1)) / 2, x1 - x0 + 1, y1 - y0 + 1);
  return out;
}
// Images des objets (icônes de la barre et de l'inventaire)
const itemImages = {};
// (objets, et blocs qui ont une image d'objet : les rails)
const withImage = [
  ...Object.entries(ITEMS).map(([id, it]) => [id, it.icon]),
  ...Object.entries(BLOCKS).filter(([, b]) => b.item).map(([id, b]) => [id, b.item]),
];
await Promise.all(withImage.map(([id, src]) => new Promise((res) => {
  const img = new Image();
  img.onload = () => { itemImages[id] = cropImage(img); res(); };
  img.onerror = res;
  img.src = src;
})));
scene.add(player.model);
await loadSkins();
// (style des personnages, puis skin choisie : lus directement, les options sont chargées plus bas)
setCharacterStyle((() => { try { return JSON.parse(localStorage.getItem('hexacraft.options'))?.skinStyle; } catch { return null; } })());
await player.loadSkin(skinUrl((() => { try { return JSON.parse(localStorage.getItem('hexacraft.options'))?.skin; } catch { return null; } })()));
await animals.init();
// icônes 3D des blocs, objets tenus en main
const items = new Items(world, itemImages);
items.buildIcons(Object.keys(BLOCKS).map(Number).filter((id) => id < 1000 || !BLOCKS[id].hidden));
items.prepareModels(); // modèles 3D des objets (outils...), en arrière-plan
const hand = new FirstPersonHand(items);
// (au-dessus des émetteurs et récepteurs de voltite : leur fréquence, voir radiotags.js)
const radioTags = new RadioTags(scene, world, circuits, (id) => items.icon(id, 64, true));
const _radioEye = new THREE.Vector3();
// usines : réseau électrique, machines, tapis, pollution, commandes des villages (voir industry.js)
const industry = new Industry(world, containers);
scene.add(industry.group);
// (réservoirs de fusée : leur carburant suit le bloc, du réseau de tuyaux à la fusée et retour)
structs.takeFuel = (k) => industry.takeFuel(k);
structs.putFuel = (k, n) => industry.putFuel(k, n);
structs.tactic = (s, dt) => !net.isClient && weapons.carTactic(s, dt); // (stratégie d'une voiture : chasser, fuir, garder)
Object.assign(industry, {
  trains, tracks, animals, colony: animals.colony, dropOf,
  pseudo: () => options.pseudo,
  iconOf: (id) => items.icon(id, 64),
  windAt: (x, z) => weather.forecast(x, z, dayCount + dayTime),
  windDir: () => weather.clouds?.wind,
  onSmoke: (x, y, z, k) => performance.now() - lastFrameAt < 250 && fx.puffs.spawn(new THREE.Vector3(x, y, z), new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4), 3 + Math.random() * 2, Math.random() < 0.5 ? '#3a3a3e' : '#5a5a60', 0.5 * k, 2.2 * k, 0.7, 0.4),
  onDrop: (it, c) => giveBack([it], new THREE.Vector3(c.x, player.pos.y, c.z)),
  onIgnite: (q, r, y) => tnt.ignite(q, r, y, null, listener),
  // (tapis : la pile qui tombe au bout, dans un carton ; le modèle 3D des piles posées dessus)
  onSpill: (it, p, v) => spawnCarton(p, [it], v, 1),
  modelOf: (id) => items.model(id),
  cartons,
  // (assembleur, scie : les recettes de l'établi)
  recipes: RECIPES,
  nameOf: (id) => itemName(id),
  onComplain: (a) => { animals.talk.say(a, 'smoke'); if (!industry.warned) { industry.warned = true; toast('Les villageois se plaignent de la fumée de tes usines (filtres à fumée, cheminées)'); } },
  onOrder: (o, done, left) => {
    const what = o.n + ' × ' + itemName(o.item);
    if (!done) { addChat('Nouvelle commande d\'un village : ' + what + ', à livrer en train à « ' + o.stationName + ' » (' + o.reward + ' lingots de fer)', 'sys'); return; }
    if (left) giveBack([{ id: IRON_INGOT, n: left }], player.pos);
    toast('Commande livrée (' + what + ') : ' + o.reward + ' lingots de fer dans le train');
  },
});
seasons.setSmog(industry.smog);
seasons.polLoad = () => industry.pollutionLoad();
// Fumée des usines respirée : un voile brun, la toux, et des dégâts quand elle est très épaisse
const smogHaze = document.createElement('div');
smogHaze.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;transition:opacity 1.5s;background:radial-gradient(ellipse at center, rgba(96,84,62,0.35), rgba(58,50,38,0.85))';
document.body.appendChild(smogHaze);
let smogT = 0, smogWarned = false;
function breatheSmog(dt) {
  const p = player.pos, v = p.y > -2 ? industry.pollutionAt(p.x, p.z) : 0;
  const o = v < 8 ? 0 : Math.min(0.55, (v - 8) / 70);
  if (Math.abs(+smogHaze.style.opacity - o) > 0.02) smogHaze.style.opacity = o.toFixed(2);
  if (v < 20) { smogT = 0; return; }
  if (!smogWarned) { smogWarned = true; toast("L'air est chargé de fumée : éloigne-toi des usines ou pose des filtres à fumée"); }
  smogT += dt;
  if (smogT < Math.max(3, 12 - v / 8)) return;
  smogT = 0;
  playCough();
  if (survival.on && v > 35) survival.damage(1);
}
let snowballs = null; // boules de neige lancées (créées au premier lancer, voir throwSnowball)
// Armes et boucliers (voir weapons.js)
const weapons = new Weapons({
  scene, world, fx, structs, animals, hexaliens, containers, circuits, tnt, listener,
  remote: () => net.isClient,
  ear: () => camera.position,
  nukesOn: () => !current?.noNukes,
  explode: (x, y, z, kind) => tnt.explode(x, y, z, { player, carts, listener }, kind),
  breakBlock: (q, r, y) => world.setBlock(q, r, y, AIR),
  hurtAnimal: (a, dmg, at, pid) => {
    const src = pid === 0 ? player.pos : net.clientOf(pid)?.proxy.pos || at;
    const drop = animals.hit(a, Math.round(dmg), src.x, src.z, pid === 0 ? options.pseudo : net.clientOf(pid)?.name || null);
    if (pid === 0) {
      if (drop && survival.on && survival.give(drop[0], drop[1])) toast('Inventaire plein');
      if (drop && a.meat && survival.on) survival.give(a.meat[0], a.meat[1]);
      if (a.dead && a.type === 'zombie' && !a.counted) { a.counted = true; zombieKilled(a); }
    } else if (drop) {
      const c = net.clientOf(pid);
      if (c) { net.sendTo(c.cid, { t: 'adrop', i: drop[0], n: drop[1] }); if (a.meat) net.sendTo(c.cid, { t: 'adrop', i: a.meat[0], n: a.meat[1] }); }
    }
  },
  hurtPlayer: (pid, dmg, from) => { if (net.active && net.pvp) net.pvpHit(from, pid, Math.max(1, Math.min(9, Math.round(dmg))), 400); },
  // joueurs touchés par un tir (en ligne) : les autres, et l'hôte lui-même si le tir vient d'un invité
  rayPlayers: (o, d, reach, from) => {
    if (!net.active) return null;
    let best = null;
    const ph = raycastPlayers(o, d, reach);
    if (ph && ph.rp.pid !== from) best = { pid: ph.rp.pid, t: ph.t };
    if (net.isHost && from !== 0) {
      for (const up of [0.45, 0.95, 1.5]) {
        const lx = player.pos.x - o.x, ly = player.pos.y + up - o.y, lz = player.pos.z - o.z;
        const tc = lx * d.x + ly * d.y + lz * d.z, d2 = lx * lx + ly * ly + lz * lz - tc * tc;
        if (tc < 0 || d2 > 0.42 * 0.42) continue;
        const t = tc - Math.sqrt(0.42 * 0.42 - d2);
        if (t <= reach && (!best || t < best.t)) best = { pid: 0, t };
      }
    }
    return best;
  },
  players: () => (net.active ? [...net.remotes.values()].filter((rp) => rp.placed).map((rp) => ({ pid: rp.pid, pos: rp.pos })).concat(net.isHost ? [{ pid: 0, pos: player.pos }] : []) : []),
  // tourelles : le joueur (s'il a choisi une équipe, en survie), ses dégâts, les munitions infinies en créatif
  teamPlayers: () => (playerTeam && survival.on && state !== 'dead' ? [{ local: true, pos: player.pos, vel: player.vel, team: playerTeam }] : []),
  rayLocal: (o, d, reach, team) => {
    if (!playerTeam || playerTeam === team || !survival.on || state === 'dead') return null;
    let best = null;
    for (const up of [0.45, 0.95, 1.5]) {
      const lx = player.pos.x - o.x, ly = player.pos.y + up - o.y, lz = player.pos.z - o.z;
      const tc = lx * d.x + ly * d.y + lz * d.z, d2 = lx * lx + ly * ly + lz * lz - tc * tc;
      if (tc < 0 || d2 > 0.42 * 0.42) continue;
      const t = tc - Math.sqrt(0.42 * 0.42 - d2);
      if (t <= reach && (best === null || t < best)) best = t;
    }
    return best;
  },
  hurtLocal: (dmg) => { if (survival.on) survival.damage(Math.max(1, Math.round(dmg / 3))); },
  freeAmmo: () => !survival.on,
  // (un tir d'arme en bloc : les invités le voient)
  onFire: (kind, P, d) => { if (net.isHost) net.broadcastJoined({ t: 'wpk', k: kind, o: [P.x, P.y, P.z], d: [d.x, d.y, d.z] }); },
});
{
  const after = world.afterSet;
  world.afterSet = (q, r, y, id, old) => { after(q, r, y, id, old); weapons.onWorldSet(q, r, y, id); };
}
// (bouclier stellaire : tout près, une explosion ne casse rien, ni dans le monde ni sur un objet)
tnt.protect = (x, y, z) => weapons.protects(x, y, z);
hand.setArm(player.parts?.armR);

// Contour de l'hexagone visé
const outline = (() => {
  const s = 1.006, pts = [];
  for (let i = 0; i < 6; i++) {
    const [ax, az] = CORNERS[i], [bx, bz] = CORNERS[(i + 1) % 6];
    for (const y of [-0.003, 1.003]) pts.push(ax * s, y, az * s, bx * s, y, bz * s);
    pts.push(ax * s, -0.003, az * s, ax * s, 1.003, az * s);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7 }));
  line.visible = false;
  scene.add(line);
  return line;
})();

function hexIcon(tile, size = 40) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    ctx.lineTo(size / 2 + size * 0.49 * Math.cos(a), size / 2 + size * 0.49 * Math.sin(a));
  }
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.drawImage(tile, 0, 0, size, size);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  return c;
}

// ---------- Barre d'objets (9 cases, modifiable avec l'inventaire) ----------
const HOTBAR_SIZE = 10;
const slotKey = (i) => (i === 9 ? 0 : i + 1);
// barre sauvegardée avant la 0.5.2 (9 cases) : complétée
const fitHotbar = (saved) => Array.from({ length: HOTBAR_SIZE }, (_, i) => { const id = saved[i]; return BLOCKS[id] || ITEMS[id] ? id : 0; });
const defaultHotbar = () => Array.from({ length: HOTBAR_SIZE }, (_, i) => HOTBAR[i] || 0);
let hotbar = defaultHotbar();
const itemName = (id) => (BLOCKS[id] || ITEMS[id])?.name ?? '';

// ---------- Mode survie (voir survival.js) ----------
// En survie, la barre montre les 10 premières cases de l'inventaire (avec les quantités).
const survival = new Survival({
  icon: (id, size) => blockIcon(id, size),
  name: itemName,
  onChange: () => {
    // coffre / four ouvert en ligne : les autres joueurs voient le changement
    if (boxKey && survival.box && net.active) net.boxChanged(boxKey, containers.data(survival.box));
    wearSync();
    if (!survival.on) return;
    if (account.loggedIn) account.checkItems(survival.slots);
    for (let i = 0; i < HOTBAR_SIZE; i++) hotbar[i] = survival.slots[i]?.id || 0;
    renderHotbar();
  },
  onDeath: () => { playDeath(); playSting('death'); showDeath(); },
  onHurt: (n) => { playHurt(); pad?.rumble(Math.min(1, 0.35 + (n || 1) * 0.06)); },
  onCraft: () => playCraft(),
});

// ---------- Tutoriel : la station Hexa-Zéro (voir tutorial.js et station.js) ----------
// Le ciel du tutoriel : la station est sur l'orbite de sa ruine (voir ruinRel), autour de PXT-1.
// Elle se tient de façon à garder la planète au sud, un peu en dessous (hublots de la cabine, du
// couloir, de la serre et du hangar), et l'étoile PXT-A au-dessus d'elle (toits vitrés).
const TUTO_PLANET = new THREE.Vector3(0.2, -0.1, -1).normalize(), UP = new THREE.Vector3(0, 1, 0);
const _tutoQ = new THREE.Quaternion(), _tq = new THREE.Quaternion(), _tq2 = new THREE.Quaternion(), _tv = new THREE.Vector3(), _ts = new THREE.Vector3(), _tu = new THREE.Vector3();
function tutoSky() {
  const day = (sky.days || 0) + dayTime, seed = sky.viewSeed;
  const P = bodyPos('pxt1', day, seed), S = bodyPos('pxta', day, seed), rel = ruinRel(day, _tv);
  const at = { x: P.x + rel.x, y: P.y + rel.y, z: P.z + rel.z };
  // (la planète : où la station la garde)
  _tq.setFromUnitVectors(TUTO_PLANET, _ts.copy(rel).negate().normalize());
  // (puis on tourne autour de cet axe : l'étoile passe en haut)
  _ts.set(S.x - at.x, S.y - at.y, S.z - at.z).normalize().applyQuaternion(_tq2.copy(_tq).invert());
  _ts.addScaledVector(TUTO_PLANET, -_ts.dot(TUTO_PLANET));
  _tu.copy(UP).addScaledVector(TUTO_PLANET, -UP.dot(TUTO_PLANET));
  const a = Math.atan2(TUTO_PLANET.dot(_tv.crossVectors(_tu, _ts)), _tu.dot(_ts));
  _tq.multiply(_tq2.setFromAxisAngle(TUTO_PLANET, a));
  sky.viewAt = at;
  sky.viewQ = _tutoQ.copy(_tq);
}
const TUTO_ID = '__tutoriel', TUTO2_ID = '__tutoriel2'; // (ses sauvegardes, une par chapitre ; jamais montrées dans la liste des mondes)
const inTuto = () => current?.type === 'tutorial';
// la coque de la station ne se casse pas (acier, verre, lampes) : on ne tombe pas dans le vide
const TUTO_HULL = new Set([245, 246, 247, 40, 94, 95, 81, 67]);
const tutoLocked = (id) => inTuto() && TUTO_HULL.has(id);
const tutorial = new Tutorial({
  survival, player, world, containers, industry, scene, structs,
  pilot: () => player.pilot,
  shuttle: { ...STATION_SPOTS.shuttle, y: STATION_Y + 1 },
  hurt: (n) => survival.damage(Math.min(n, survival.health - 4)),
  visible: () => (state === 'playing' || survival.open) && !document.body.classList.contains('cutscene'),
  blip: (done) => playBlip(done),
  keyName: (a) => (Controls.ACTIONS.some(([x]) => x === a) ? Controls.actionKey(a) : null),
  alarm: () => { playAlarm(); setTimeout(playAlarm, 450); },
  gateSound: () => playDoor(),
  // dans la navette : elle part (voir departure.js), puis retour au menu. La formation est
  // sauvegardée juste avant ; le départ, lui, ne l'est pas (la navette attend encore au hangar
  // si l'on revient dans la station)
  onFinish: () => {
    account.unlock('tutoriel');
    saveGame(false);
    departing = true;
    document.body.classList.add('cutscene');
    playMusic('hope', 2);
    crashScene = playDeparture({
      scene, world, atlas, at: { ...STATION_SPOTS.shuttle, y: STATION_Y + 1 }, end: STATION_SPOTS.hangarEnd,
      onEnd: () => {
        crashScene = null;
        departing = false;
        stopMusic(4);
        document.body.classList.remove('cutscene');
        if (document.pointerLockElement) document.exitPointerLock();
        if (inTuto()) enterTitle();
      },
    });
  },
});
// ---------- Tiers technologiques et conseils d'ORA (voir progress.js) ----------
const progress = new Progress({
  player, survival, world, industry, tracks, trains, structs,
  get flight() { return flight; },
  get orbital() { return orbital; },
  get animals() { return animals; },
  hotbar: () => hotbar,
  seed: () => current?.seed ?? '0',
  keyName: (a) => (Controls.ACTIONS.some(([x]) => x === a) ? Controls.actionKey(a) : null),
  visible: () => (state === 'playing' || survival.open) && !document.body.classList.contains('cutscene') && !tutorial.on,
  blip: (done) => playBlip(done),
  toast: (t) => toast(t),
  night: () => isNight(),
  advice: () => options.advice || 'some',
  rocketFuel: (s) => (s.rocket?.cap ? rockets.fuel(s) / s.rocket.cap : 1),
  beaconInWreck: () => beaconInWreck(),
});
const MP_PROG_KEY = 'hexacraft.mpprog';
// ---------- La fin du jeu : la balise interstellaire (voir industry.js et ending.js) ----------
// Elle doit être dans l'épave du Traveler-98 (elle se branche sur son antenne). Un monde sans épave
// (l'endroit était déjà exploré) : n'importe où sur Hexa.
function inWreckXZ(x, z) {
  if (zoneOfXZ(x, z) !== 0) return false;
  const s = world.gen?.crashSite?.();
  if (!s) return true;
  const dx = x - s.x, dz = z - s.z, u = dx * s.c + dz * s.s, v = -dx * s.s + dz * s.c;
  return u > -8 && u < 62 && Math.abs(v) < 16;
}
function beaconInWreck() {
  for (const [k, id] of industry.nodes) {
    if (id !== BEACON) continue;
    const [q, r] = k.split(',').map(Number), w = hexToWorld(q, r);
    if (inWreckXZ(w.x, w.z)) return true;
  }
  return false;
}
const SIGNAL_TIER = TIERS.findIndex((T) => T.id === 'signal');
industry.onBeacon = (q, r, y) => {
  if (crashScene || introOn || state !== 'playing' || inTuto()) return;
  const w = hexToWorld(q, r);
  if (!inWreckXZ(w.x, w.z)) { toast("ORA : sans l'antenne du Traveler-98, la balise ne porte pas jusqu'à la Terre. Pose-la dans son épave."); return; }
  if (progress.on && survival.on && progress.tier < SIGNAL_TIER) { toast("ORA : Pas encore, cadet. Termine d'abord les six tiers technologiques."); return; }
  startEnding(w.x, y + 0.5, w.z);
};
function startEnding(x, y, z) {
  progress.event('signal');
  document.body.classList.add('cutscene');
  // (en pause, sans l'écran de pause : la souris est relâchée pour la scène, comme l'écrasement)
  keys.clear();
  mouse.left = mouse.right = false;
  if (state === 'playing') state = 'paused';
  hideScreens();
  if (document.pointerLockElement) document.exitPointerLock();
  playMusic('hope', 2);
  crashScene = playEnding({
    scene, at: { x, y, z },
    onEnd: () => {
      crashScene = null;
      stopMusic(3);
      document.body.classList.remove('cutscene');
      saveGame(false);
      lock();
    },
  });
}
// Boutons « Tutoriel » de l'écran titre : chapitre 1 (la survie) ou chapitre 2 (l'industrie et les
// véhicules), chacun dans sa propre sauvegarde ; reprendre la formation, ou la recommencer
async function startTutorial(chapter = 1) {
  const id = chapter === 2 ? TUTO2_ID : TUTO_ID;
  const saved = Save.listWorlds().find((w) => w.id === id && !w.broken);
  if (saved && (saved.tuto?.step | 0) > 0) {
    const resume = await ask("Reprendre ce chapitre là où tu t'étais arrêté ?", 'Reprendre', 'Recommencer');
    if (resume) { playWorld(saved); return; }
  }
  const now = new Date().toISOString();
  playWorld({
    game: 'HexaCraft', version: 2, id, name: chapter === 2 ? 'Tutoriel 2 — industrie et véhicules' : 'Tutoriel — station Hexa-Zéro', type: 'tutorial', genVersion: GEN_LATEST,
    mode: 'survival', seed: 'hexa-zero', createdAt: now, savedAt: now, world: { chunks: {} }, player: { slot: 0 }, tuto: { chapter, step: 0 },
  });
}
document.getElementById('btn-tuto').addEventListener('click', () => startTutorial(1));
document.getElementById('btn-tuto2').addEventListener('click', () => startTutorial(2));
// Icône d'un bloc (prisme en 3D) ou d'un objet, bien nette (voir held.js)
function blockIcon(id, size = 40) {
  return items.icon(id, size, true);
}

const hotbarEl = document.getElementById('hotbar');
const slotEls = Array.from({ length: HOTBAR_SIZE }, (_, i) => {
  const el = document.createElement('div');
  el.className = 'hslot';
  el.style.setProperty('--i', i);
  const n = document.createElement('span');
  n.textContent = slotKey(i);
  el.appendChild(n);
  hotbarEl.appendChild(el);
  return el;
});
const blockNameEl = document.getElementById('blockname');
let slot = 0;
let mergeFirst = null; // double colle : premier objet choisi (voir useDoubleGlue)
let ropeFirst = null;  // corde : premier bout accroché (voir useRope)
let nameTimer = 0;

// Dessine les icônes d'une rangée de cases d'après la barre (en survie : avec la quantité)
function fillSlots(els) {
  els.forEach((el, i) => {
    el.querySelector('canvas')?.remove();
    el.querySelector('b')?.remove();
    const id = hotbar[i];
    el.title = id ? itemName(id) : '';
    if (id) el.prepend(blockIcon(id, el.classList.contains('hslot') ? 38 : 48));
    const n = survival.on ? survival.count(i) : 0;
    if (n > 1) {
      const b = document.createElement('b');
      b.textContent = n;
      el.appendChild(b);
    }
    wearBar(el, survival.on ? survival.slots[i] : null);
  });
}
function renderHotbar() {
  fillSlots(slotEls);
  if (invSlotEls) fillSlots(invSlotEls);
}

function selectSlot(i, quiet = false) {
  slot = ((i % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
  slotEls.forEach((el, j) => el.classList.toggle('active', j === slot));
  invSlotEls?.forEach((el, j) => el.classList.toggle('active', j === slot));
  if (quiet) return;
  blockNameEl.textContent = hotbar[slot] === GLUE
    ? 'Super colle — clic droit : coller / décoller · Maj + clic droit : assembler (ou reposer un objet)'
    : hotbar[slot] === ROPE
      ? `Corde — clic droit sur un bloc (ou un objet collé), puis sur un 2e point à moins de ${ROPE_MAX} blocs · Maj + clic droit : retirer les cordes de ce bloc`
    : hotbar[slot] === DOUBLE_GLUE
      ? 'Double colle — clic droit sur un objet collé, puis sur un 2e objet qui le touche : ils n\'en font plus qu\'un'
    : hotbar[slot] === BELT
      ? 'Tapis roulant — clic droit sur un arbre de transmission, puis sur un 2e arbre aligné (20 cases au plus, à plat ou en pente)'
    : hotbar[slot] === SCHEMATIC
      ? 'Schématique — clic gauche / clic droit : les deux coins d\'une zone · Maj + clic droit : le menu (enregistrer, choisir un plan) · clic droit sur un fantôme : le construire · clic gauche : le retirer'
    : hotbar[slot] === GRAVITY_HAND
      ? 'Main gravitationnelle — clic droit sur un objet collé : l\'attraper / le lâcher · clic gauche : le tourner (Maj : dans l\'autre sens) · R : changer d\'axe (X, Y, Z) · X : le redresser · molette : rapprocher / éloigner'
      : (hotbar[slot] ? itemName(hotbar[slot]) : '');
  if (hotbar[slot] !== GRAVITY_HAND) releaseGrab();
  if (hotbar[slot] !== DOUBLE_GLUE) mergeFirst = null;
  if (hotbar[slot] !== ROPE) ropeFirst = null;
  blockNameEl.classList.add('show');
  clearTimeout(nameTimer);
  nameTimer = setTimeout(() => blockNameEl.classList.remove('show'), 1500);
}

// ---------- Inventaire créatif (touche E) ----------
// Clique un bloc puis une case de la barre, ou survole un bloc et appuie sur 1-9.
// Clic sur une case pleine sans rien en main : on prend son bloc. Clic droit : vider la case.
const invGrid = document.getElementById('inv-grid');
const invSearch = document.getElementById('inv-search');
const invHeld = document.getElementById('inv-held');
const invHotbarEl = document.getElementById('inv-hotbar');
let held = 0;        // bloc "en main" dans l'inventaire
let hoverId = 0;     // bloc survolé dans la grille
let invSlotEls = null;

invSlotEls = Array.from({ length: HOTBAR_SIZE }, (_, i) => {
  const el = document.createElement('div');
  el.className = 'slot';
  const n = document.createElement('span');
  n.textContent = slotKey(i);
  el.appendChild(n);
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (e.button === 2) { hotbar[i] = 0; }
    else if (held) { hotbar[i] = held; setHeld(0); }
    else if (hotbar[i]) { setHeld(hotbar[i]); hotbar[i] = 0; }
    selectSlot(i, true);
    renderHotbar();
  });
  invHotbarEl.appendChild(el);
  return el;
});

// emplacement « Tête » de l'inventaire créatif : on y pose un chapeau tenu ; clic droit : l'enlever
const invHeadEl = document.getElementById('inv-head');
invHeadEl.addEventListener('mousedown', (e) => {
  e.preventDefault();
  if (e.button === 2) survival.head = null;
  else if (held) { if (ITEMS[held]?.wear !== 'head') return; survival.head = makeSlot(held, 1); setHeld(0); }
  else if (survival.head) { setHeld(survival.head.id); survival.head = null; }
  renderInvHead();
  wearSync();
});
function renderInvHead() {
  invHeadEl.innerHTML = '';
  invHeadEl.title = survival.head ? itemName(survival.head.id) : 'Tête (chapeau)';
  if (survival.head) invHeadEl.appendChild(blockIcon(survival.head.id, 32));
}
function setHeld(id) {
  held = id;
  invHeld.innerHTML = '';
  if (id) invHeld.appendChild(blockIcon(id, 44));
}

// Onglets de l'inventaire créatif : catégories et ordre dans invcats.js. Les pièces d'ordinateur
// sont secrètes (/secret on). La recherche cherche partout.
let invTab = 'all';
const invTabs = document.getElementById('inv-tabs');
function renderInvTabs() {
  if (invTab === 'pc' && !options.secret) invTab = 'all';
  invTabs.innerHTML = '';
  for (const [k, label] of INV_TABS) {
    if (k === 'pc' && !options.secret) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'inv-tab' + (k === invTab ? ' on' : '');
    b.textContent = label;
    b.addEventListener('mousedown', (e) => { e.preventDefault(); invTab = k; renderInvTabs(); renderInventory(); });
    invTabs.appendChild(b);
  }
}

function renderInventory() {
  const query = invSearch.value.trim().toLowerCase();
  invGrid.innerHTML = '';
  const list = [];
  for (const [key, b] of [...Object.entries(BLOCKS), ...Object.entries(ITEMS)]) {
    if (!b || b.hidden || (query && !b.name.toLowerCase().includes(query))) continue;
    const id = Number(key);
    if (!query && invTab !== 'all' && invCategory(id)[0] !== invTab) continue;
    list.push(id);
  }
  list.sort(invSort);
  for (const id of list) {
    const b = BLOCKS[id] || ITEMS[id];
    const el = document.createElement('div');
    el.className = 'slot';
    el.title = b.name;
    el.appendChild(blockIcon(id, 48));
    el.addEventListener('mousedown', (e) => { e.preventDefault(); setHeld(held === id ? 0 : id); });
    el.addEventListener('mouseenter', () => { hoverId = id; });
    el.addEventListener('mouseleave', () => { if (hoverId === id) hoverId = 0; });
    invGrid.appendChild(el);
  }
}
invSearch.addEventListener('input', renderInventory);
document.addEventListener('mousemove', (e) => {
  invHeld.style.transform = `translate(${e.clientX - 22}px, ${e.clientY - 22}px)`;
});

function openInventory() {
  if (spectator) return;
  if (survival.on) { openCraft(2); return; }
  state = 'inventory';
  keys.clear();
  mouse.left = mouse.right = false;
  setHeld(0);
  invSearch.value = '';
  renderInvTabs();
  renderInventory();
  renderInvHead();
  renderHotbar();
  selectSlot(slot, true);
  show('inventory');
  document.exitPointerLock();
}

function closeInventory() {
  setHeld(0);
  hideScreens();
  state = 'paused';
  lock(true);
}

// Survie : inventaire avec la grille 2x2 (n = 2), ou table de craft 3x3 (n = 3)
function openCraft(n) {
  if (spectator) return;
  state = 'craft';
  keys.clear();
  mouse.left = mouse.right = false;
  survival.openScreen(n);
  show('craft');
  document.exitPointerLock();
}
// Coffre / four : même écran que l'inventaire de survie. En créatif, l'inventaire montré
// est la barre (chaque objet en pile pleine) ; à la fermeture, la barre reprend ce qu'il y a.
let boxCreative = false;
// En ligne, c'est l'hôte qui garde le contenu des coffres et fours : un autre joueur ouvre une
// copie, remplie et tenue à jour par l'hôte, et lui envoie ce qu'il y change (voir net.js).
let boxKey = null; // clé du coffre / four ouvert ("q,r,y" ou "S<id>:q,r,y")
// (s, k : coffre / four posé sur un objet physique, case locale k)
// (direct : un contenu déjà là, celui d'un wagon de train : il n'a pas de clé en ligne)
// (tkey : la clé en ligne d'un contenu direct, « T<id> » pour un wagon)
function openBox(q, r, y, s = null, k = null, direct = null, tkey = null) {
  const key = direct ? tkey : s ? 'S' + s.id + ':' + k : q + ',' + r + ',' + y;
  let box;
  if (direct && net.isClient && tkey) { box = emptyBox('chest'); net.boxOpen(tkey); }
  else if (direct) box = direct;
  else if (net.isClient) {
    const type = BLOCKS[s ? s.blocks.get(k) : world.getBlock(q, r, y)]?.container;
    if (!type) return;
    box = emptyBox(type); // (rempli dès que l'hôte répond)
    net.boxOpen(key);
  } else box = s ? containers.atStruct(s, k) : containers.at(q, r, y);
  if (!box) return;
  boxKey = key;
  state = 'craft';
  keys.clear();
  mouse.left = mouse.right = false;
  boxCreative = !survival.on;
  if (boxCreative) {
    survival.slots.fill(null);
    hotbar.forEach((id, i) => { if (id) survival.slots[i] = { id, n: stackMax(id) }; });
    document.body.classList.add('box-creative');
  }
  // (machine : son nom en titre, et ce qu'elle a comme cases)
  const bid = direct ? 0 : s ? s.blocks.get(k) : world.getBlock(q, r, y);
  survival.openBox(box, BLOCKS[bid]?.machine || BLOCKS[bid]?.titled ? { title: BLOCKS[bid].name, kind: BLOCKS[bid].machine || null } : null);
  if (box.type === 'chest') playChest(true);
  show('craft');
  document.exitPointerLock();
}
// Client : contenu d'un coffre / four reçu de l'hôte (celui qu'on regarde)
function boxReceived(k, c) {
  if (k !== boxKey || !survival.box) return;
  if (containers.apply(survival.box, c, true)) survival.render();
}

function closeCraft() {
  if (tradeWith) animals.talk.say(tradeWith, Math.random() < 0.5 ? 'bye' : 'tomorrow');
  tradeWith = null;
  if (boxKey && survival.box) { net.boxClose(boxKey); }
  if (survival.box && survival.box.type === 'chest') playChest(false);
  boxKey = null;
  const lost = survival.closeScreen();
  if (boxCreative) {
    boxCreative = false;
    for (let i = 0; i < HOTBAR_SIZE; i++) hotbar[i] = survival.slots[i]?.id || 0;
    survival.slots.fill(null);
    document.body.classList.remove('box-creative');
    renderHotbar();
    selectSlot(slot, true);
  } else if (lost) toast('Inventaire plein : des objets ont été perdus');
  hideScreens();
  state = 'paused';
  lock(true);
}

// ---------- Commerce avec un villageois ----------
// Chaque villageois propose 3 échanges, toujours les mêmes (tirés de sa graine). En survie
// seulement : les objets de gauche quittent l'inventaire, ceux de droite y arrivent.
const TRADES = [
  [[163, 6], [122, 1]], [[194, 4], [122, 1]], [[195, 4], [122, 1]], [[104, 16], [122, 2]],
  [[122, 2], [164, 4]], [[122, 1], [23, 12]], [[5, 12], [122, 1]], [[122, 8], [130, 1]],
  [[130, 6], [131, 1]], [[122, 3], [40, 8]], [[122, 2], [96, 1]], [[122, 4], [123, 2]], [[122, 6], [17, 16]],
];
// Prix selon l'avis du villageois : un ami fait une remise, celui qui se méfie demande plus
const PRICE = { friend: 0.75, neutral: 1, wary: 1.5 };
const MOOD_TEXT = { friend: 'te considère comme un ami (prix réduits)', neutral: '', wary: 'se méfie de toi (prix plus élevés)' };
function tradesOf(a) {
  const f0 = PRICE[animals.talk.mood(a, options.pseudo)] || 1;
  // un villageois qui a un métier vend ce qu'il produit (voir colony.js)
  if (a.job && JOB_TRADES[a.job]) return JOB_TRADES[a.job].map(([[cid, cn], r]) => [[cid, Math.max(1, Math.round(cn * f0))], r]);
  const out = [];
  let s = a.seed >>> 0;
  while (out.length < 3) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const t = TRADES[s % TRADES.length];
    if (!out.includes(t)) out.push(t);
  }
  const f = PRICE[animals.talk.mood(a, options.pseudo)] || 1;
  return out.map(([[cid, cn], r]) => [[cid, Math.max(1, Math.round(cn * f))], r]);
}
const invCount = (id) => survival.slots.reduce((n, s) => n + (s?.id === id ? s.n : 0), 0);
function invTake(id, n) {
  for (let i = survival.slots.length - 1; i >= 0 && n > 0; i--) {
    const s = survival.slots[i];
    if (s?.id !== id) continue;
    const k = Math.min(n, s.n);
    s.n -= k; n -= k;
    if (!s.n) survival.slots[i] = null;
  }
}
// Valeur d'un objet en lingots de fer (la monnaie des villageois), d'après leurs échanges ;
// sinon : la nourriture selon ce qu'elle nourrit, un outil 1 lingot, le reste presque rien
const WORTH = (() => {
  const w = {};
  const add = ([[cid, cn], [rid, rn]]) => {
    if (rid === IRON_INGOT && cid !== IRON_INGOT) w[cid] = Math.max(w[cid] || 0, rn / cn);
    if (cid === IRON_INGOT && rid !== IRON_INGOT) w[rid] = Math.max(w[rid] || 0, cn / rn);
  };
  TRADES.forEach(add);
  Object.values(JOB_TRADES).forEach((l) => l.forEach(add));
  w[IRON_INGOT] = 1;
  return w;
})();
const worthOf = (id) => WORTH[id] ?? (ITEMS[id]?.food ? ITEMS[id].food / 12 : ITEMS[id]?.tool ? 1 : 1 / 32);
// Cadeau (hôte) : l'avis remonte selon sa valeur (un lingot de fer : +10, 50 au plus d'un coup)
function receiveGift(a, name, id, n) {
  if (!a || a.dead || a.type !== 'villager' || (!ITEMS[id] && !BLOCKS[id]) || !(n > 0)) return;
  const gain = Math.max(3, Math.min(50, Math.round(worthOf(id) * n * 10)));
  animals.talk.gifted(a, name, gain, animals.colony.receive(a, id, Math.min(n, 64)));
  return gain;
}
// Tapis roulant : on y pose la pile tenue (créatif : sans la perdre), ou on reprend son objet
function clickBelt(q, r, y) {
  const id = hotbar[slot];
  const held = !id ? null : survival.on ? (survival.slots[slot] ? { id, n: survival.slots[slot].n } : null) : { id, n: stackMax(id) };
  if (net.isClient) { net.csend({ t: 'indq', a: 'click', q, r, y, i: held?.id || 0, n: held?.n || 0 }); hand.punch(); return; }
  const res = industry.beltClick(q, r, y, held);
  if (!res) return;
  hand.punch();
  if (res.put && survival.on) survival.take(slot, held.n);
  if (res.took && survival.on) {
    const left = survival.give(res.took.id, res.took.n);
    if (left) { const w = hexToWorld(q, r); giveBack([{ id: res.took.id, n: left }], new THREE.Vector3(w.x, y, w.z)); }
  }
}

// (invité) Réponse de l'hôte à ce qu'on a fait sur une usine (voir net.js, indq)
function industryReply(m) {
  if (m.a === 'ask') { if (typeof m.k === 'string') industry.setRemoteText(m.k, typeof m.txt === 'string' ? m.txt : null); return; }
  if (m.a === 'cfg') { if (typeof m.msg === 'string') { toast(m.msg); playClick(); } return; }
  if (m.a === 'link') {
    if (typeof m.err === 'string') { toast(m.err); return; }
    useHeld();
    playPlace('stone');
    return;
  }
  if (m.a !== 'click' || !survival.on) return;
  // (la pile posée quitte l'inventaire ; la pile reprise y entre, le reste tombe dans un carton)
  if (Number.isInteger(m.put) && m.put > 0) {
    const i = survival.slots[slot]?.id === m.i ? slot : survival.slots.findIndex((x) => x?.id === m.i);
    if (i >= 0) survival.take(i, m.put);
  }
  if (Array.isArray(m.took) && (BLOCKS[m.took[0]] || ITEMS[m.took[0]]) && m.took[1] > 0) {
    const left = survival.give(m.took[0], Math.min(4096, m.took[1] | 0), m.took[2] || undefined);
    if (left) giveBack([{ id: m.took[0], n: left }], player.pos.clone());
  }
}

// Tapis roulant en main (comme dans Create) : clic droit sur un arbre de transmission, puis sur
// un second, aligné avec lui : le tapis se tend entre les deux (il va du premier vers le second).
// Accroupi + clic droit : on pose le tapis comme un objet sur un tapis (voir clickBelt)
let beltStart = null;
function beltLink() {
  if (!target) return;
  const { q, r, y } = target.hit, aimed = world.getBlock(q, r, y);
  if (isBelt(aimed)) { clickBelt(q, r, y); return; }
  if (!isShaft(aimed)) { toast(beltStart ? 'Clique sur un deuxième arbre de transmission (Maj + clic droit pour annuler)' : "Un tapis se tend entre deux arbres de transmission : clic droit sur le premier"); return; }
  if (!beltStart || beltStart.q === q && beltStart.r === r && beltStart.y === y || performance.now() - beltStart.t > 60000) {
    beltStart = { q, r, y, t: performance.now() };
    toast('Tapis : clique sur un deuxième arbre, dans le sens où il doit aller (20 cases au plus, à plat ou en pente)');
    return;
  }
  if (net.isClient) {
    net.csend({ t: 'indq', a: 'link', q: beltStart.q, r: beltStart.r, y: beltStart.y, q2: q, r2: r, y2: y });
    beltStart = null;
    hand.punch();
    return;
  }
  const err = industry.link(beltStart, { q, r, y });
  if (err) { toast(err); return; }
  beltStart = null;
  useHeld();
  hand.punch();
  placedFx(q, r, y);
}

// On offre ce qu'on tient (toute la pile) au villageois visé
function giftVillager(a) {
  const id = hotbar[slot];
  let n;
  if (survival.on) {
    const s = survival.slots[slot];
    if (!s) return;
    n = s.n;
    survival.take(slot, n);
  } else n = stackMax(id);
  hand.punch();
  account.unlock('cadeau');
  if (net.isClient) { net.csend({ t: 'vgift', id: a.id, i: id, n }); toast('Cadeau offert : le village s\'en souviendra'); return; }
  const before = animals.talk.mood(a, options.pseudo);
  const gain = receiveGift(a, options.pseudo, id, n);
  const after = animals.talk.mood(a, options.pseudo);
  if (before === 'afraid' && after !== 'afraid') account.unlock('pardon');
  if (gain >= 50) account.unlock('mecene');
  toast(after === before ? 'Cadeau offert : le village s\'en souviendra'
    : after === 'friend' ? 'Cadeau offert : ce villageois te considère maintenant comme un ami'
    : after === 'neutral' ? 'Cadeau offert : ce villageois t\'a pardonné'
    : 'Cadeau offert : ce villageois n\'a plus peur de toi (il se méfie encore)');
}
let tradeWith = null;
function openTrade(a) {
  tradeWith = a;
  if (animals.talk.mood(a, options.pseudo) === 'friend') account.unlock('ami');
  animals.talk.say(a, 'want');
  state = 'craft'; // (même fermeture que l'inventaire : E ou Échap, voir closeCraft)
  keys.clear();
  mouse.left = mouse.right = false;
  renderTrade();
  show('trade');
  document.exitPointerLock();
}
// Taxi : le véhicule sur lequel le joueur se tient (avec un gravitron et un levier), ou null
function taxiVehicle() {
  const s = player.standingOn;
  if (!s) return null;
  let grav = null, lever = null;
  for (const [k, id] of s.blocks) { if (id === GRAVITRON) grav = k; else if (id === LEVER || id === LEVER_ON) lever = k; }
  return grav && lever ? { s, grav, lever } : null;
}
const TAXI_FARE = 1; // (survie : un lingot de fer la course)
// Les destinations du taxi : les blocs cibles du monde (les plateformes des villages en sont),
// sauf ceux tout près
function renderTaxi(list) {
  const v = taxiVehicle();
  for (const c of targetList().filter((c) => c.d > 30).slice(0, 12)) {
    const row = document.createElement('div');
    row.className = 'trade-row';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = `${c.name} (${Math.round(c.d)} blocs)`;
    const btn = document.createElement('button');
    btn.textContent = 'Partir';
    btn.disabled = !v || net.isClient || (survival.on && invCount(IRON_INGOT) < TAXI_FARE);
    btn.addEventListener('click', () => {
      const veh = taxiVehicle();
      if (!veh || net.isClient) return;
      if (survival.on) { if (invCount(IRON_INGOT) < TAXI_FARE) return; invTake(IRON_INGOT, TAXI_FARE); }
      // le chauffeur règle le gravitron (mode avion, vers la cible) et lève le levier
      structs.setParams(veh.s, veh.grav, [...c.t, 1]);
      veh.s.blocks.set(veh.lever, LEVER_ON);
      structs.afterEdit(veh.s);
      // il monte avec toi, te dépose, puis ramène le véhicule à la plateforme
      // (ses militaires qui le suivent montent avec lui)
      const escort = animals.list.filter((b) => b.mode === 'follow' && JOBS[b.job]?.recruit && (!b.owner || b.owner === options.pseudo) && b.pos.distanceTo(player.pos) < 16);
      animals.colony.taxiStart(tradeWith, veh.s, veh.grav, c.t, escort);
      world.changed = true;
      animals.talk.say(tradeWith, 'deal');
      toast(`Taxi : direction « ${c.name} » — tiens-toi bien !`);
      closeCraft();
    });
    row.append(name, btn);
    list.appendChild(row);
  }
  if (!list.children.length) {
    const p = document.createElement('p');
    p.className = 'inv-hint';
    p.textContent = 'Aucune destination : pose des blocs cibles (ou visite d\'autres villages avec une plateforme)';
    list.appendChild(p);
  }
}
// Militaires : on recrute un villageois (en survie : RECRUIT_COST lingots de fer) en lui
// choisissant sa tenue ; ensuite, on lui donne des ordres
const RECRUIT_COST = 4;
const SOLDIER_SKINS = [['soldier', 'Tenue 1'], ['soldier2', 'Tenue 2']];
// Ordre à un militaire (invité : par l'hôte)
function order(a, o) {
  if (net.isClient) { net.csend({ t: 'vorder', id: a.id, o }); a.mode = o === 'stay' ? 'stay' : 'follow'; if (o === 'civil') a.job = null; }
  else animals.command(a, o);
}
function renderRecruit(list) {
  const a = tradeWith;
  const row = (label, el) => {
    const r = document.createElement('div');
    r.className = 'trade-row';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = label;
    r.append(name, ...el);
    list.appendChild(r);
  };
  const button = (text, on, disabled = false) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.disabled = disabled;
    b.addEventListener('click', on);
    return b;
  };
  if (JOBS[a.job]?.recruit) {
    const mode = a.mode === 'stay' ? 'garde sa position' : 'te suit';
    row(`Militaire : il ${mode}`, []);
    row('Ordres', [
      button('Suis-moi', () => { order(a, 'follow'); renderTrade(); }),
      button('Garde ici', () => { order(a, 'stay'); renderTrade(); }),
      button('Démobiliser', async () => { if (await ask('Rendre ce militaire à la vie civile ?', 'Démobiliser')) { order(a, 'civil'); closeCraft(); } }),
    ]);
    return;
  }
  if (a.type !== 'villager' || a.job === 'taxi') return;
  const afraid = animals.talk.mood(a, options.pseudo) === 'afraid';
  const poor = survival.on && invCount(IRON_INGOT) < RECRUIT_COST;
  row(`Recruter comme militaire${survival.on ? ` (${RECRUIT_COST} lingots de fer)` : ''} : choisis sa tenue`, SOLDIER_SKINS.map(([job, label]) => {
    const b = button('', () => {
      if (afraid || (survival.on && invCount(IRON_INGOT) < RECRUIT_COST)) return;
      if (survival.on) invTake(IRON_INGOT, RECRUIT_COST);
      // (invité : l'hôte le recrute pour lui)
      if (net.isClient) net.csend({ t: 'vrecruit', id: a.id, j: job });
      else if (!animals.recruit(a, job, options.pseudo)) return;
      toast('Nouveau militaire : il te suit et combat les monstres (parle-lui pour lui donner des ordres)');
      renderTrade();
    }, afraid || poor);
    b.className = 'recruit-skin';
    const img = document.createElement('img');
    img.src = `texture/entites/villageois/metiers/${JOBS[job].skin}.png`;
    img.alt = '';
    b.append(img, document.createTextNode(label));
    return b;
  }));
}
// Médecin : il te soigne (en survie : HEAL_PRICE lingots de fer)
const HEAL_PRICE = 2;
function renderDoctor(list) {
  const row = document.createElement('div');
  row.className = 'trade-row';
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = survival.on ? `Se faire soigner (${HEAL_PRICE} lingots de fer)` : 'Le médecin soigne en survie';
  const btn = document.createElement('button');
  btn.textContent = 'Soigner';
  btn.disabled = !survival.on || survival.health >= MAX_HEALTH || invCount(IRON_INGOT) < HEAL_PRICE;
  btn.addEventListener('click', () => {
    if (!survival.on || invCount(IRON_INGOT) < HEAL_PRICE) return;
    invTake(IRON_INGOT, HEAL_PRICE);
    survival.heal(MAX_HEALTH);
    animals.talk.say(tradeWith, 'fine');
    toast('Le médecin t\'a soigné');
    renderTrade();
  });
  row.append(name, btn);
  list.appendChild(row);
}
function renderTrade() {
  const list = document.getElementById('trade-list');
  list.textContent = '';
  if (tradeWith.job === 'taxi') renderTaxi(list);
  if (tradeWith.job === 'doctor') renderDoctor(list);
  renderRecruit(list);
  const slotOf = ([id, n]) => {
    const el = document.createElement('div');
    el.className = 'slot';
    survival.fill(el, { id, n });
    return el;
  };
  for (const t of tradesOf(tradeWith)) {
    const [[cid, cn], [rid, rn]] = t;
    const row = document.createElement('div');
    row.className = 'trade-row';
    const arrow = document.createElement('i');
    arrow.className = 'arrow';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = `${cn} ${itemName(cid)} → ${rn} ${itemName(rid)}`;
    const btn = document.createElement('button');
    btn.textContent = 'Échanger';
    btn.disabled = !survival.on || invCount(cid) < cn;
    btn.addEventListener('click', () => {
      if (!survival.on || invCount(cid) < cn) return;
      invTake(cid, cn);
      const left = survival.give(rid, rn);
      if (left) toast('Inventaire plein : des objets ont été perdus');
      account.unlock('commerce');
      if (account.bump('trades') >= 50) account.unlock('marchand');
      if (tradeWith.job === 'baker') account.unlock('boulanger');
      animals.talk.say(tradeWith, ['deal', 'emerald', 'fair', 'thanks'][Math.floor(Math.random() * 4)]);
      if (net.isClient) net.csend({ t: 'vtrade', id: tradeWith.id });
      else animals.talk.traded(tradeWith, options.pseudo);
      renderTrade();
    });
    row.append(slotOf(t[0]), arrow, slotOf(t[1]), name, btn);
    list.appendChild(row);
  }
  const mood = MOOD_TEXT[animals.talk.mood(tradeWith, options.pseudo)];
  document.getElementById('trade-title').textContent = SPECIES[tradeWith.type].name + (tradeWith.job ? ` (${JOBS[tradeWith.job].name.toLowerCase()})` : '') + (mood ? ` · ${mood}` : '');
  const village0 = animals.colony.describe(tradeWith); // (l'hôte seulement)
  // (une commande de livraison en cours dans son village, voir industry.js)
  const vk = animals.colony.villageOf(tradeWith)?.key;
  const ord = vk != null ? industry.orderOf(vk) : null;
  const village = (village0 ? village0 + '\n' : '') + (ord ? `Commande du village : ${ord.n} × ${itemName(ord.item)}, à livrer en train à « ${ord.stationName} » (${ord.reward} lingots de fer)` : '');
  if (tradeWith.job === 'taxi') {
    document.getElementById('trade-hint').textContent = (village ? village + '\n' : '') + (taxiVehicle()
      ? `Choisis ta destination : le chauffeur règle le véhicule et le lance${survival.on ? ` (${TAXI_FARE} lingot de fer la course)` : ''} · E ou Échap : fermer`
      : 'Monte d\'abord sur un véhicule de la plateforme (debout dessus), puis parle au chauffeur · E ou Échap : fermer');
    return;
  }
  document.getElementById('trade-hint').textContent = (village ? village + '\n' : '') + (survival.on
    ? 'Clique « Échanger » : les objets de gauche quittent ton inventaire, ceux de droite y arrivent · E ou Échap : fermer'
    : 'Le commerce se fait en survie (en créatif, tout est déjà dans l\'inventaire) · E ou Échap : fermer');
}

// ---------- /worldrule [règle] [true | false] ----------
// Les règles du monde (sauvegardées avec lui). Sans valeur : on dit la valeur actuelle.
const WORLD_RULES = {
  carburantInfini: {
    alias: ['carburantinfini', 'infinitefuel', 'carburant', 'fuel'], what: 'carburant des fusées infini',
    get: () => rockets.infinite, set: (v) => { rockets.infinite = v; current.infiniteFuel = v; },
  },
  degatVehicule: {
    alias: ['degatvehicule', 'dégatvehicule', 'dégâtvéhicule', 'degatsvehicules', 'dégâtsvéhicules', 'vehicledamage'], what: 'les objets collés (voitures, fusées...) peuvent être abîmés',
    get: () => !structs.noDamage, set: (v) => { structs.noDamage = !v; current.noVehicleDamage = !v; },
  },
  chargesNucleaires: {
    alias: ['chargesnucleaires', 'chargesnucléaires', 'nucleaire', 'nucléaire', 'nukes'], what: 'charges nucléaires autorisées',
    get: () => !current?.noNukes, set: (v) => { current.noNukes = !v; },
  },
};
function worldruleCommand(args) {
  if (!current) return;
  if (!args.length) {
    addChat('Règles du monde : ' + Object.entries(WORLD_RULES).map(([k, R]) => k + ' = ' + R.get()).join(', '), 'sys');
    addChat('/worldrule <règle> true | false pour la changer', 'sys');
    return;
  }
  const a = args[0].toLowerCase();
  const name = Object.keys(WORLD_RULES).find((k) => k.toLowerCase() === a || WORLD_RULES[k].alias.includes(a));
  if (!name) { addChat('Règle inconnue : ' + args[0] + ' (règles : ' + Object.keys(WORLD_RULES).join(', ') + ')', 'err'); return; }
  const R = WORLD_RULES[name], v = args[1]?.toLowerCase();
  if (v === undefined) { addChat(name + ' = ' + R.get() + ' (' + R.what + ' : ' + (R.get() ? 'oui' : 'non') + ')', 'sys'); return; }
  if (v !== 'true' && v !== 'false') { addChat('Valeur : true ou false (ex. /worldrule ' + name + ' true)', 'err'); return; }
  R.set(v === 'true');
  world.changed = true;
  addChat(name + ' = ' + v + ' (' + R.what + ' : ' + (v === 'true' ? 'oui' : 'non') + ')', 'sys');
}

// ---------- /secret on | off ----------
// Montre ou cache les objets secrets (pièces d'ordinateur) : inventaire créatif et wiki
function secretCommand(arg) {
  const on = /^(on|oui|1)$/i.test(arg || '') ? true : /^(off|non|0)$/i.test(arg || '') ? false : null;
  if (on === null) { addChat('/secret on ou /secret off', 'sys'); return; }
  options.secret = on;
  saveOptions();
  setSecretItems(on);
  addChat(on ? 'Objets secrets visibles' : 'Objets secrets cachés', 'sys');
}

// ---------- /gamemode survie | creatif ----------
// Chaque mode garde ses affaires : la barre du créatif et l'inventaire de survie sont mis
// de côté pendant qu'on joue dans l'autre mode (et sauvegardés avec le monde).
let modeStash = { hotbar: null, inv: null };
const MODE_WORDS = {
  survie: 'survival', survival: 'survival', s: 'survival', 0: 'survival',
  creatif: 'creative', 'créatif': 'creative', creative: 'creative', c: 'creative', 1: 'creative',
};
function gamemodeCommand(arg) {
  if (net.isClient) { addChat('En multijoueur, seul l\'hôte peut changer de mode de jeu', 'err'); return; }
  if (survival.hardcore || spectator) { addChat('Mode hardcore : on ne change pas de mode de jeu', 'err'); return; }
  const now = survival.on ? 'survival' : 'creative';
  const label = (m) => (m === 'survival' ? 'Survie' : 'Créatif');
  if (!arg) { addChat(`Mode de jeu : ${label(now)} (/gamemode survie ou /gamemode creatif)`, 'sys'); return; }
  const mode = MODE_WORDS[arg.toLowerCase()];
  if (!mode) { addChat(`Mode inconnu : ${arg} (survie ou creatif)`, 'err'); return; }
  if (mode === now) { addChat(`Tu es déjà en mode ${label(mode)}`, 'sys'); return; }
  setGameMode(mode);
  addChat(`Mode de jeu : ${label(mode)}`, 'sys');
}
function setGameMode(mode) {
  // en solo, le monde change de mode ; en ligne, l'hôte change seulement le sien (les joueurs qui
  // le rejoignent gardent le mode du monde)
  // (passé en créatif une fois : plus de succès dans ce monde, même revenu en survie)
  if (current && mode === 'creative' && !current.cheated) {
    current.cheated = true;
    toast('Mode créatif : les succès sont désactivés pour ce monde (même en revenant en survie)');
  }
  if (current) {
    if (net.isHost) current.hostMode = mode;
    else { current.mode = mode; delete current.hostMode; }
  }
  if (mode === 'survival') {
    modeStash.hotbar = hotbar.slice();
    survival.load(true, modeStash.inv, MAX_HEALTH);
    player.fly = false;
  } else {
    modeStash.inv = survival.saveInv();
    survival.load(false);
    hotbar = modeStash.hotbar ? fitHotbar(modeStash.hotbar) : defaultHotbar();
    renderHotbar();
  }
  stopMining();
  selectSlot(slot, true);
  world.changed = true;
}

// ---------- /weather ----------
// /weather <niveau> : centre de pression à cet endroit (voir climate.js), de -PRESS_MAX
// (anticyclone : beau temps) à PRESS_MAX (dépression creuse : orages, tornades). Il ne
// change pas le temps d'un coup : il se forme peu à peu et dérive avec le vent.
// /weather : le temps qu'il fait ici ; /weather reset : plus de centres de pression.
// Rend les lignes à afficher [{ text, kind }] (aussi pour un joueur en ligne, voir net.js).
function weatherCommand(args, pos) {
  const cl = sky.clouds.climate, T = dayCount + dayTime, arg = (args[0] || '').toLowerCase();
  const pct = (v) => Math.round(v * 100) + ' %';
  if (!arg) {
    const f = weather.forecast(pos.x, pos.z, T), [ax, az] = cl.toAdv(pos.x, pos.z, T), pr = cl.pressureAt(ax, az, T);
    const sky_ = f.rain > 0.02 ? (f.storm > 0.3 ? 'orage' : f.rain > 0.6 ? 'forte pluie' : 'pluie') : f.cover > 0.7 ? 'couvert' : f.cover > 0.3 ? 'nuageux' : 'dégagé';
    return [{ text: `Météo ici : ${sky_} (nuages ${pct(f.cover)}, pluie ${pct(f.rain)}, orage ${pct(f.storm)})` + (Math.abs(pr) > 0.05 ? `, pression : ${pr > 0 ? 'dépression' : 'anticyclone'} ${Math.abs(pr).toFixed(1)}` : ''), kind: 'sys' },
      { text: `Utilisation : /weather <niveau de -${PRESS_MAX} à ${PRESS_MAX}>, /weather tornade, /weather asteroides ou /weather reset`, kind: 'sys' }];
  }
  if (arg === 'tornade' || arg === 'tornado') {
    cl.addPressure(pos.x, pos.z, T, PRESS_MAX, true);
    return [{ text: 'Tempête ! Le ciel se couvre en quelques secondes et une tornade arrive dans une quinzaine de secondes, à une centaine de blocs : éloigne-toi (ou pas…)', kind: 'sys' }];
  }
  // pluie d'astéroïdes (voir weather.js) : la nuit, pour celui qui la lance (en solo : le monde)
  if (arg === 'asteroides' || arg === 'astéroïdes' || arg === 'meteores' || arg === 'météores') {
    weather.forceShower = !weather.forceShower;
    if (weather.forceShower) weather.nextImpact = 8;
    return [{ text: weather.forceShower ? 'Pluie d\'astéroïdes : étoiles filantes toute la nuit, et des météores qui tombent au loin (le premier dans quelques secondes, la nuit). /weather asteroides à nouveau pour l\'arrêter' : 'Pluie d\'astéroïdes arrêtée (les nuits naturelles en gardent)', kind: 'sys' }];
  }
  if (arg === 'reset' || arg === 'clear') {
    cl.setPressures([]);
    return [{ text: 'Centres de pression retirés : le temps redevient naturel peu à peu', kind: 'sys' }];
  }
  const level = Number(arg.replace(',', '.'));
  if (!Number.isFinite(level) || level === 0 || Math.abs(level) > PRESS_MAX) return [{ text: `Niveau invalide : de -${PRESS_MAX} à ${PRESS_MAX} (sauf 0), ou tornade`, kind: 'err' }];
  cl.addPressure(pos.x, pos.z, T, level);
  const what = level > 0
    ? (level >= 4 ? 'dépression très creuse : orages violents, tornades possibles' : level >= 2 ? 'dépression : nuages et pluie, orages possibles' : 'faible dépression : plus de nuages')
    : (level <= -3 ? 'anticyclone fort : grand beau temps' : 'anticyclone : moins de nuages');
  return [{ text: `Centre de pression ${level > 0 ? '+' : ''}${level} créé ici (${what}). Le temps change en moins d'une minute ; le centre dure ensuite environ 15 min en dérivant avec le vent (/weather reset pour l'arrêter).`, kind: 'sys' }];
}

// ---------- /tp ----------
// /tp x y z   : coordonnées du monde (celles de F3, XYZ) ; ~ = relatif (~ ~5 ~ : 5 blocs plus haut)
// /tp x z     : posé au sol à cet endroit
// /tp spawn   : point d'apparition du monde
// /tp pseudo  : à côté d'un autre joueur (en multijoueur)
// (le monde n'a pas de bord : la carte graphique ne voit que les environs, voir origin.js ; au-delà
// de 100 000 milliards de blocs, les positions du joueur, en nombres 64 bits, deviendraient trop
// grossières pour la physique — il faudrait 500 000 ans de course pour y arriver)
const TP_LIMIT = 100_000_000_000_000;
// (F3 et /tp comptent depuis l'origine de l'astre où l'on est : voir localOrigin dans spacegen.js)
function groundY(x, z) {
  const { q, r } = worldToHex(x, z);
  // premier bloc non vide en partant du haut : sur l'eau, on arrive à la surface (pas au fond)
  for (let y = H - 1; y > Y_MIN; y--) if (world.getBlock(q, r, y - 1) !== AIR) return y;
  return H;
}
// /place <structure> [x y z] : un village (habité), une pièce de village, ou une structure
// enregistrée avec le bloc de structure. ~ = position actuelle (~ ~ ~ par défaut). Le village
// s'adapte au terrain ; le reste est posé à la hauteur donnée (plancher au ras des pieds).
// /voie x1 z1 x2 z2 [options] : une voie de train entre deux points (voir layLine dans tracks.js)
// /voie <longueur> [options] : droit devant soi ; /voie aide ; /voie stop : arrête la pose en cours
// Options (dans n'importe quel ordre) : double, triple, voies=N (1 à 4), y=N (ou un 5e nombre),
// pont=<matériau> (pierre, bois, brique, beton, ardoise, paves, diorite, fer), remblai (du gravier
// jusqu'au sol au lieu des ponts), lampes[=N] (un lampadaire toutes les N cases, 16 par défaut),
// gares[=N] (aux deux bouts, ou toutes les N cases), butoirs, vitesse=N (un panneau au départ),
// signaux[=N] (un signal toutes les N cases, 100 par défaut).
const VOIE_HELP = [
  '/voie x1 z1 x2 z2 [options] : une voie entre deux points (~ = ta position, ex. /voie ~ ~ ~200 ~)',
  '/voie <longueur> [options] : droit devant toi (ex. /voie 300 double lampes)',
  'Options : double, triple, voies=N (1 à 4), y=N, pont=pierre|bois|brique|beton|ardoise|paves|diorite|fer,',
  'remblai (pas de pont : du gravier jusqu\'au sol), lampes[=N], gares[=N], butoirs, vitesse=N (km/h), signaux[=N]',
  'Pente : y2=N (hauteur à l\'arrivée ; y2=~-20 : 20 blocs plus bas que le départ), descente=N, montee=N (4 cases par bloc au plus)',
  'La voie passe à travers tout, la bedrock comprise (ex. /voie 400 descente=60 : sous la bedrock d\'un ancien monde plat)',
  '/voie espace <astre> : une ligne de train vers un autre astre (ex. /voie espace glacia) : une rampe, des tours, la ligne, une rampe à l\'arrivée, une gare à chaque bout',
  '/voie stop : arrête la pose en cours',
];
function voieCommand(args) {
  const usage = () => addChat('Utilisation : /voie x1 z1 x2 z2 [options] ou /voie <longueur> [options] (/voie aide : tout voir)', 'err');
  if (/^(aide|help|\?)$/i.test(args[0] || '')) { for (const l of VOIE_HELP) addChat(l, 'sys'); return; }
  if (/^(stop|annuler|arret)$/i.test(args[0] || '')) {
    if (!trackJob) { addChat('Aucune voie en cours de pose', 'err'); return; }
    trackJob = null;
    tracks.hold = false;
    tracks.dirty = true;
    addChat('Pose de la voie arrêtée (les morceaux déjà posés restent)', 'sys');
    return;
  }
  if (/^espace$/i.test(args[0] || '')) { spaceLine(args[1]); return; }
  const opts = { lanes: 1 }, nums = [];
  let yArg, y2Arg;
  for (const a of args) {
    const [k, v] = a.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split('=');
    const n = v !== undefined ? Number(v) : NaN;
    if (/^(double|deux)$/.test(k)) opts.lanes = 2;
    else if (/^(triple|trois)$/.test(k)) opts.lanes = 3;
    else if (k === 'voies' && n >= 1 && n <= 4) opts.lanes = Math.floor(n);
    else if (k === 'y' && v !== undefined) yArg = v;
    else if ((k === 'y2' || k === 'arrivee') && v !== undefined) y2Arg = v;
    else if (k === 'descente' && n > 0) y2Arg = '~-' + n;
    else if (k === 'montee' && n > 0) y2Arg = '~' + n;
    else if (k === 'pont' || k === 'materiau') {
      if (!LINE_MATS[v]) { addChat('Matériau inconnu. Au choix : ' + Object.keys(LINE_MATS).join(', '), 'err'); return; }
      opts.mat = v;
    } else if (k === 'remblai' || k === 'sanspont') opts.embank = true;
    else if (k === 'lampes' || k === 'lampadaires') opts.lamps = n >= 4 ? Math.floor(n) : 16;
    else if (k === 'gares') opts.stations = n >= 16 ? Math.floor(n) : true;
    else if (k === 'butoirs' || k === 'butoir') opts.buffers = true;
    else if (k === 'signaux' || k === 'signal') opts.signals = n >= 16 ? Math.floor(n) : 100;
    else if (k === 'vitesse' && n >= 0 && n <= 400) opts.kmh = Math.floor(n);
    else if (v !== undefined) { addChat('Option inconnue : ' + a, 'err'); return; }
    else nums.push(a);
  }
  const val = (a, base) => {
    const rel = a.startsWith('~');
    const n = rel ? (a.length > 1 ? Number(a.slice(1).replace(',', '.')) : 0) : Number(a.replace(',', '.'));
    return Number.isFinite(n) ? (rel ? base + n : n) : NaN;
  };
  let x1, z1, x2, z2;
  if (nums.length === 1 || nums.length === 2) {
    // droit devant soi, sur la longueur donnée
    const len = Number(nums[0]);
    if (!(len >= 4 && len <= 20000)) { usage(); return; }
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    [x1, z1, x2, z2] = [player.pos.x, player.pos.z, player.pos.x + fx * len, player.pos.z + fz * len];
    if (nums[1] !== undefined) yArg ??= nums[1];
  } else if (nums.length >= 4) {
    [x1, z1, x2, z2] = [val(nums[0], player.pos.x), val(nums[1], player.pos.z), val(nums[2], player.pos.x), val(nums[3], player.pos.z)];
    if (nums[4] !== undefined) yArg ??= nums[4];
  } else { usage(); return; }
  if ([x1, z1, x2, z2].some(Number.isNaN)) { usage(); return; }
  // hauteur : donnée, sinon juste au-dessus du sol au point de départ (le monde descend jusqu'en Y_MIN)
  const s = worldToHex(x1, z1);
  const y = yArg !== undefined ? Math.floor(val(yArg, player.pos.y)) : world.surface(s.q, s.r).h + 1;
  if (!Number.isFinite(y) || y < Y_MIN + 2 || y > 1e6) { addChat(`Hauteur invalide (${Y_MIN + 2} au moins)`, 'err'); return; }
  // arrivée : à la même hauteur, ou à celle donnée (~ : par rapport au départ)
  if (y2Arg !== undefined) {
    const y2 = Math.floor(val(y2Arg, y));
    if (!Number.isFinite(y2) || y2 < Y_MIN + 2 || y2 > 1e6) { addChat(`Hauteur d'arrivée invalide (${Y_MIN + 2} au moins)`, 'err'); return; }
    opts.y2 = y2;
  }
  if (trackJob) { addChat("Une voie est déjà en train d'être posée : attends qu'elle soit finie (ou /voie stop)", 'err'); return; }
  const job = tracks.layLine(x1, z1, x2, z2, y, opts);
  if (job.error) { addChat(job.error, 'err'); return; }
  if (current && !current.noRank) { current.noRank = true; addChat('Commande /voie : ce monde ne compte plus pour les classements', 'sys'); }
  trackJob = { job, lanes: opts.lanes, y, shown: 0, t0: performance.now() };
  addChat('Pose de la voie en cours… (le jeu continue pendant ce temps ; /voie stop pour arrêter)', 'sys');
}
// /voie espace <astre> : une ligne de train d'ici à un autre astre (voir tracks.layToSpace)
function spaceLine(name) {
  const plain = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const ids = ['hexa', ...LAND_IDS()]; // (avec les planètes des systèmes ajoutés, voir src/systemes)
  const id = ids.find((i) => i === plain(name) || plain(BODY[i].name) === plain(name));
  if (!id) { addChat('Utilisation : /voie espace <astre> (' + ids.map((i) => BODY[i].name).join(', ') + ')', 'err'); return; }
  const here = zoneOfXZ(player.pos.x, player.pos.z), k = id === 'hexa' ? 0 : bodyZone(id);
  if (here < 0) { addChat('Il faut partir du sol d\'un astre', 'err'); return; }
  if (here === k) { addChat('Tu es déjà sur ' + BODY[id].name, 'err'); return; }
  if (systemOf(zoneBody(here)) !== systemOf(BODY[id])) { addChat('Trop loin : ' + BODY[id].name + ' est dans un autre système, à des années-lumière. Il faut y aller en fusée', 'err'); return; }
  if (trackJob) { addChat("Une voie est déjà en train d'être posée : attends qu'elle soit finie (ou /voie stop)", 'err'); return; }
  const s = worldToHex(player.pos.x, player.pos.z), y = world.surface(s.q, s.r).h + 1;
  const job = tracks.layToSpace(player.pos.x, player.pos.z, y, { x: k * ZONE + (BODY[id].locked ? spanOf(BODY[id]) / 4 : 0), zMax: spanOf(BODY[id]) * 0.2 }); // (une planète synchrone : on arrive sur le crépuscule)
  if (job.error) { addChat(job.error, 'err'); return; }
  if (current && !current.noRank) { current.noRank = true; addChat('Commande /voie : ce monde ne compte plus pour les classements', 'sys'); }
  trackJob = { job, lanes: 1, y, shown: 0, t0: performance.now(), to: BODY[id].name };
  addChat(`Pose de la ligne vers ${BODY[id].name} en cours… (le jeu continue pendant ce temps ; /voie stop pour arrêter)`, 'sys');
}
// (la voie se pose petit à petit, quelques millisecondes à chaque image : voir layLine)
let trackJob = null;
function stepTrackJob() {
  const tj = trackJob;
  if (!tj) return;
  if (!tj.job.step(6)) {
    const pct = Math.floor(tj.job.progress * 4) * 25;
    if (pct > tj.shown && performance.now() - tj.t0 > 3000) { tj.shown = pct; addChat(`Pose de la voie : ${pct} %`, 'sys'); }
    return;
  }
  trackJob = null;
  const res = tj.job.result;
  if (res.error) { addChat(res.error, 'err'); return; }
  if (res.space) { addChat(`Ligne vers ${tj.to} posée : ${res.rails} rails sur les rampes, une gare à chaque bout. Prends un train, avance vers le haut de la rampe : il file tout seul sur la ligne.`, 'sys'); return; }
  const v = res.curves ? `, ${res.curves} virage${res.curves > 1 ? 's' : ''}` : '';
  const ouvrages = [res.bridges ? 'ponts' : '', res.tunnels ? 'tunnels' : ''].filter(Boolean).join(' et ');
  const extra = [res.lamps && `${res.lamps} lampadaires`, res.stations && `${res.stations} gare${res.stations > 1 ? 's' : ''}`, res.buffers && `${res.buffers} butoirs`, res.signs && `${res.signs} panneau${res.signs > 1 ? 'x' : ''} de vitesse`, res.signals && `${res.signals} signaux`].filter(Boolean).join(', ');
  const lanes = ['', '', ' double', ' triple', ' quadruple'][tj.lanes] || '';
  addChat(`Voie${lanes} posée : ${res.len} cases, ${res.rails} rails${v} (${res.y2 !== res.y0 ? `de la hauteur ${res.y0} à ${res.y2}` : `hauteur ${res.y0}`})${ouvrages ? ', avec ' + ouvrages : ''}${extra ? ' — ' + extra : ''}`, 'sys');
}
function placeCommand(args) {
  const names = Object.keys(BUILDS).join(', ');
  const usage = () => addChat(`Utilisation : /place <structure> [x y z] (~ = position actuelle). Structures : ${names}, ou une structure enregistrée`, 'err');
  if (state === 'dead') return;
  if (!args.length) { usage(); return; }
  // (le nom d'une structure enregistrée peut contenir des espaces : les coordonnées sont les 3 derniers mots)
  const coord = /^~?-?[\d.,]*$/;
  let pos = [player.pos.x, player.pos.y, player.pos.z];
  let words = args;
  if (args.length >= 4 && args.slice(-3).every((a) => coord.test(a) && a !== '')) {
    pos = args.slice(-3).map((a, i) => {
      const rel = a.startsWith('~');
      const n = rel ? (a.length > 1 ? Number(a.slice(1).replace(',', '.')) : 0) : Number(a.replace(',', '.'));
      return Number.isFinite(n) ? (rel ? pos[i] + n : n) : NaN;
    });
    words = args.slice(0, -3);
    if (pos.some(Number.isNaN)) { usage(); return; }
  }
  const [x, y, z] = pos;
  if (Math.abs(x) > TP_LIMIT || Math.abs(z) > TP_LIMIT) { addChat(`Trop loin : ${TP_LIMIT.toLocaleString(LANG === 'en' ? 'en-GB' : 'fr-FR')} blocs au plus`, 'err'); return; }
  const name = words.join(' '), kind = name.toLowerCase();
  const { q, r } = worldToHex(x, z), yi = Math.max(1, Math.min(H - 12, Math.floor(y + 0.01)));
  if (BUILDS[kind]) {
    addChat(animals.colony.build(kind, q, r, yi, player.pos.x, player.pos.z), 'sys');
  } else {
    const s = structStore.list().find((s) => s.name.toLowerCase() === kind);
    if (!s) { addChat(`Structure inconnue : « ${name} ». Structures : ${names}, ou une structure enregistrée`, 'err'); return; }
    const n = placeStructure(world, structs, s.data, q, r, yi, { x: 0, y: 0, z: 0 }, 0);
    addChat(`« ${s.name} » placée : ${n} blocs`, 'sys');
  }
  world.changed = true;
}

// ---------- /time ----------
// /time jour | nuit : midi ou minuit ; ajouter « eternel » (ou /time eternel jour...) : l'heure
// ne bouge plus ; /time normal : le temps repart ; /time : l'heure qu'il est.
const TIME_SPOTS = { jour: 0.25, day: 0.25, midi: 0.25, nuit: 0.75, night: 0.75, minuit: 0.75, matin: 0.03, soir: 0.47 };
function timeCommand(args) {
  const words = args.map((a) => a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const forever = words.some((w) => /^(eternel(le)?|toujours|lock|bloque)$/.test(w));
  const spot = words.find((w) => TIME_SPOTS[w] !== undefined);
  if (!words.length) {
    addChat(`Il est ${clockText(dayTime)}${timeLock !== null ? (timeLock < 0.5 ? ' (jour éternel)' : ' (nuit éternelle)') : ''}. /time jour | nuit [éternel], /time normal`, 'sys');
    return;
  }
  if (words.some((w) => /^(normal|off|reprendre|stop)$/.test(w))) {
    timeLock = null;
    addChat('Le temps passe de nouveau normalement', 'sys');
    world.changed = true;
    return;
  }
  if (spot === undefined) { addChat('Utilisation : /time jour | nuit | matin | soir, ajoute « éternel » pour que l\'heure ne bouge plus, /time normal pour la libérer', 'err'); return; }
  dayTime = TIME_SPOTS[spot];
  timeLock = forever ? dayTime : null;
  world.changed = true;
  const name = dayTime < 0.5 ? 'Jour' : 'Nuit';
  addChat(forever ? `${name} éternel${name === 'Nuit' ? 'le' : ''} (/time normal pour que le temps reparte)` : `Il est maintenant ${clockText(dayTime)}`, 'sys');
}

// ---------- /saison ----------
// /saison : la saison, le jour et la température ici ; /saison printemps | été | automne | hiver :
// on avance jusqu'au début de cette saison (les jours passent : la lune, les villages suivent)
const SEASON_WORDS = { printemps: 0, spring: 0, ete: 1, summer: 1, automne: 2, autumn: 2, fall: 2, hiver: 3, winter: 3 };
function seasonCommand(args) {
  const w = (args[0] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!w) {
    addChat(`${seasons.label()} — ${Math.round(seasons.here ?? 0)} °C ici. Une saison dure ${SEASON_DAYS} jours. /saison printemps | été | automne | hiver`, 'sys');
    return;
  }
  const s = SEASON_WORDS[w];
  if (s === undefined) { addChat('Utilisation : /saison printemps | été | automne | hiver', 'err'); return; }
  const d = seasons.daysTo(s, dayCount + dayTime);
  dayCount += d;
  sky.setDay(dayCount);
  seasons.T = dayCount + dayTime;
  lastSeason = seasons.season();
  world.changed = true;
  addChat(d ? `C'est maintenant : ${seasons.label()}` : `C'est déjà : ${seasons.label()}`, 'sys');
}
// Changement de saison : un message (pas au chargement du monde)
let lastSeason = -1;
function seasonTick() {
  if (state === 'menu') { lastSeason = -1; return; }
  const s = seasons.season();
  if (lastSeason >= 0 && s !== lastSeason && (flight.dilation || 1) < 50) toast(['Le printemps arrive', "C'est l'été", "L'automne arrive", "L'hiver arrive"][s]);
  lastSeason = s;
}

// ---------- /vaisseau ----------
// Le HEXA-7 de la cinématique, intact (ses deux ailes, ses vitres, ses lampes), en objet
// physique : il apparaît devant soi, un peu au-dessus du sol, tourné dans le sens du regard,
// et tombe. On peut entrer dedans, le pousser, le coller à d'autres objets ou le reposer en
// blocs (Maj + clic droit avec la colle). Ses réacteurs (blocs physiques) sont éteints : il
// suffit de les alimenter (levier...) et de régler le gravitron du cockpit pour le piloter.
function shipCommand() {
  if (state === 'dead') return;
  if (net.isClient) { addChat('Seul l\'hôte de la partie peut faire apparaître le vaisseau', 'err'); return; }
  const list = shipBlocks().map(([q, r, y, id]) => [q, r, y, id === 67 ? 66 : id]);
  // devant soi (à 45 blocs, assez loin pour ne pas tomber dessus), au-dessus de ce qui s'y trouve
  const f = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const at = player.pos.clone().addScaledVector(f, 45);
  const c = worldToHex(at.x, at.z), o = hexToWorld(c.q, c.r);
  let top = 0;
  for (const [dq, dr] of [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8], [8, -8], [-8, 8]]) top = Math.max(top, world.surface(c.q + dq, c.r + dr).h);
  const y = Math.min(H - 14, Math.max(top, Math.floor(player.pos.y)) + 4);
  const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
  const s = structs.create(++structs.nextId, o.x, y, o.z, quat, list);
  structs.updateMotor(s);
  structs.wake(s);
  structs.changed(s);
  world.changed = true;
  addChat(`Le HEXA-7 est apparu devant toi : ${s.list.length} blocs, ${(s.mass / 1000).toFixed(0)} t (objet physique)`, 'sys');
}

// ---------- /afk ----------
// Le monde continue de tourner quand on n'est plus dans le jeu (menu, autre fenêtre, fenêtre
// réduite), comme en ligne : villages, fours, eau, temps qui passe... Le joueur, lui, reste
// immobile là où il est. /afk à nouveau (ou quitter le monde) pour l'arrêter.
let afk = false;
// ---------- /equipe ----------
// L'équipe du joueur : les tourelles des autres équipes lui tirent dessus (en survie) ; celles de la
// sienne, jamais. Sans équipe, on regarde le spectacle : aucune tourelle ne le vise.
let playerTeam = null;
function teamCommand(arg) {
  const plain = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!arg) { addChat(`Ton équipe : ${teamOf(playerTeam)?.name || 'aucune'}. Utilisation : /equipe rouge | bleu | vert | jaune | aucune`, 'sys'); return; }
  const a = plain(arg);
  if (a === 'aucune' || a === 'aucun' || a === 'none') { playerTeam = null; addChat('Tu n\'es plus dans aucune équipe : les tourelles ne te visent plus', 'sys'); return; }
  const t = TEAMS.find((x) => plain(x.id) === a || plain(x.name) === a || plain(x.id).startsWith(a));
  if (!t) { addChat('Équipes : rouge, bleu, vert, jaune (ou aucune)', 'err'); return; }
  playerTeam = t.id;
  addChat(`Tu es dans l'équipe ${t.name}${survival.on ? ' : les tourelles des autres équipes te tirent dessus' : ' (en créatif, les tourelles ne te visent pas)'}`, 'sys');
}
const live = () => net.active || afk; // le monde tourne même hors du jeu
function afkCommand() {
  if (net.active) { addChat('En ligne, le monde ne s\'arrête jamais : /afk ne sert qu\'en solo', 'sys'); return; }
  afk = !afk;
  document.body.classList.toggle('afk', afk);
  addChat(afk
    ? 'Mode AFK : le monde continue même dans le menu ou quand tu vas sur une autre fenêtre (/afk pour l\'arrêter)'
    : 'Mode AFK arrêté : le jeu se met de nouveau en pause dans le menu', 'sys');
}

// Téléportation depuis la carte : au sol (le générateur, si l'endroit n'est pas encore chargé)
function mapTeleport(x, z) {
  let y = groundY(x, z);
  if (y >= H) {
    // (pas encore chargé : la hauteur du générateur ; un monde plat, celle de son point de départ)
    try { const h = worldToHex(x, z); y = world.gen.type === 'flat' ? world.findSpawn().y : world.gen.surface(h.q, h.r).h + 2; } catch { y = 80; }
    player.fly = true; // (on flotte le temps que le terrain arrive)
  }
  show('pause');
  tpCommand([String(x.toFixed(1)), String(y), String(z.toFixed(1))], true);
  lock();
}

function tpCommand(args, raw = false) {
  const usage = () => addChat('Utilisation : /tp x y z, /tp x z, /tp spawn ou /tp pseudo (~ = position actuelle)', 'err');
  if (state === 'dead') return;
  let x, y, z;
  if (args.length === 1) {
    const name = args[0].toLowerCase();
    if (name === 'spawn') {
      const s = world.findSpawn();
      ({ x, z } = hexToWorld(s.q, s.r));
      y = s.y;
    } else {
      const other = [...net.remotes.values()].find((rp) => rp.name.toLowerCase() === name);
      if (!other) { addChat(`Joueur introuvable : ${args[0]}`, 'err'); return; }
      ({ x, y, z } = other.pos);
      x += 0.6; // à côté, pas dans le joueur
    }
  } else if (args.length === 2 || args.length === 3) {
    const axes = args.length === 3 ? args : [args[0], null, args[1]];
    const base = [player.pos.x, player.pos.y, player.pos.z];
    const val = axes.map((a, i) => {
      if (a === null) return null;
      const rel = a.startsWith('~');
      const n = rel ? (a.length > 1 ? Number(a.slice(1)) : 0) : Number(a.replace(',', '.'));
      return Number.isFinite(n) ? (rel ? base[i] + n : n) : NaN;
    });
    if (val.some((v) => Number.isNaN(v))) { usage(); return; }
    [x, y, z] = val;
    // (des coordonnées données à la main : comptées depuis l'origine de l'astre où l'on est, comme F3)
    if (!raw) { const o = localOrigin(player.pos.x, player.pos.z); if (!axes[0].startsWith('~')) x += o.x0; if (!axes[2].startsWith('~')) z += o.z0; }
    if (Math.abs(x) > TP_LIMIT || Math.abs(z) > TP_LIMIT) { addChat(`Trop loin : ${TP_LIMIT.toLocaleString(LANG === 'en' ? 'en-GB' : 'fr-FR')} blocs au plus`, 'err'); return; }
    if (y === null) y = groundY(x, z);
    y = Math.max(-10, Math.min(1e6, y));
  } else { usage(); return; }
  player.riding = null;
  player.standingOn = player.attached = player.aboard = null;
  player.pos.set(x, y, z);
  player.vel.set(0, 0, 0);
  survival.airTop = null; // pas de dégâts de chute à l'arrivée
  stopMining();
  const lo = localOrigin(x, z);
  addChat(`Téléporté en ${(x - lo.x0).toFixed(1)} / ${y.toFixed(1)} / ${(z - lo.z0).toFixed(1)}${lo.name ? ' (' + lo.name + ')' : ''}`, 'sys');
}

// /astre <astre> (créatif, outil de développement : voir src/systemes et l'atelier des systèmes) :
// sur le sol de n'importe quel astre où l'on se pose, au milieu de sa carte
function astreCommand(name) {
  const plain = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const ids = ['hexa', ...LAND_IDS()];
  const id = ids.find((i) => i === plain(name) || plain(BODY[i].name) === plain(name));
  if (!id) { addChat('Utilisation : /astre <astre> (' + ids.map((i) => BODY[i].name).join(', ') + ')', 'err'); return; }
  if (survival.on || net.isClient) { addChat('/astre : en mode créatif seulement (et pas en invité)', 'err'); return; }
  if (!flight.on) { addChat("/astre : ce monde n'a pas l'espace", 'err'); return; }
  const b = BODY[id], k = id === 'hexa' ? 0 : bodyZone(id), x = k * ZONE + (b.locked ? spanOf(b) / 4 : 0), z = 0;
  const h = worldToHex(x, z), y = world.gen.surface(h.q, h.r).h + 4;
  if (player.pilot) leavePilot(true);
  player.riding = null;
  player.standingOn = player.attached = player.aboard = null;
  player.pos.set(x, y, z);
  player.vel.set(0, 0, 0);
  player.fly = true;
  survival.airTop = null;
  stopMining();
  addChat(`Sur ${b.name}${b.custom ? ' (système ajouté : ' + b.custom + ')' : ''}`, 'sys');
}

// Mort en survie : écran rouge, puis réapparition au point de départ
let deathBy = null; // (le joueur qui vient de nous frapper : pour /scoreboard)
function showDeath() {
  state = 'dead';
  commands.localDeath(deathBy);
  if (survival.on) account.unlock('mort');
  if (survival.on && account.loggedIn) { account.stats.survie = 0; account.saveStats(); account.setSurvival(0); survAcc = 0; }
  account.reset('nights');
  keys.clear();
  mouse.left = mouse.right = false;
  releaseGrab();
  if (player.riding) { if (net.isClient) net.cartAction('dismount'); else carts.dismount(player); }
  // hardcore : la partie est finie (plus de réapparition : spectateur, ou retour au menu)
  const hc = survival.on && survival.hardcore;
  if (hc) {
    if (current && !net.isClient) { current.over = true; world.changed = true; saveGame(); }
    if (net.isClient) hardcoreOverOnline();
  }
  document.getElementById('dead-title').textContent = hc ? 'Partie terminée !' : 'Tu es mort !';
  document.getElementById('dead-title').classList.toggle('dead-hc', hc);
  document.getElementById('dead-sub').textContent = hc ? 'Mode hardcore : il n\'y avait qu\'une vie. Le monde reste à voir, en spectateur.' : 'Tes objets sont restés dans ton inventaire.';
  document.getElementById('btn-respawn').hidden = hc;
  document.getElementById('btn-spectate').hidden = !hc;
  document.getElementById('btn-dead-title').hidden = !hc;
  show('dead');
  document.exitPointerLock();
}

// ---------- Spectateur (hardcore : après la mort) ----------
// On vole partout et on regarde, sans rien casser, poser, prendre ni subir.
let spectator = false;
function setSpectator(on) {
  spectator = !!on;
  document.getElementById('spectator-tag').hidden = !spectator;
  document.body.classList.toggle('spectator', spectator);
  if (!spectator) return;
  survival.load(false);
  survival.setHardcore(false);
  hotbar = new Array(hotbar.length).fill(0);
  renderHotbar();
  selectSlot(0, true);
  player.fly = true;
}
document.getElementById('btn-spectate').addEventListener('click', () => {
  survival.respawn();
  burnLeft = 0;
  cold = 0;
  freezing = false;
  fireFx.stop();
  frostFx.stop();
  survival.setHeartStyle('');
  setSpectator(true);
  state = 'playing';
  show('hud');
  lock();
});
document.getElementById('btn-dead-title').addEventListener('click', () => { survival.respawn(); setSpectator(false); if (current) saveGame(false); enterTitle(); });
document.getElementById('btn-respawn').addEventListener('click', () => {
  survival.respawn();
  // on réapparaît ni en feu, ni gelé
  burnLeft = 0;
  cold = 0;
  freezing = false;
  weather.clear();
  tornadoes.clear();
  fireFx.stop();
  frostFx.stop();
  survival.setHeartStyle('');
  player.spawn();
  hideScreens();
  state = 'paused';
  lock();
});

const toastEl = document.getElementById('toast');
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

// ---------- Confirmation ----------
// Petite fenêtre Oui / Annuler dans le jeu, à la place de confirm() : dans Electron, après
// une fenêtre native, les champs de texte ne recevaient plus le clavier. Promesse : true / false.
const askEl = document.getElementById('ask');
let askDone = null;
function ask(text, yes = 'Oui', no = 'Annuler') {
  askDone?.(false);
  document.getElementById('ask-text').textContent = text;
  document.getElementById('ask-yes').textContent = yes;
  document.getElementById('ask-no').textContent = no;
  askEl.hidden = false;
  return new Promise((resolve) => {
    askDone = (v) => { askDone = null; askEl.hidden = true; resolve(v); };
  });
}
document.getElementById('ask-yes').addEventListener('click', () => askDone?.(true));
document.getElementById('ask-no').addEventListener('click', () => askDone?.(false));
// Entrée : oui, Échap : non (et rien d'autre ne reçoit ces touches pendant ce temps)
addEventListener('keydown', (e) => {
  if (!askDone) return;
  if (e.code === 'Enter' || e.code === 'NumpadEnter') askDone(true);
  else if (e.code === 'Escape') askDone(false);
  else return;
  e.preventDefault();
  e.stopImmediatePropagation();
}, true);

// ---------- Options ----------
const OPT_KEY = 'hexacraft.options';
// v2 : "dist" est la distance totale (avec les grands hexas au loin), plus seulement le détail complet
const options = { v: 2, fov: 75, sens: 100, dist: 192, clouds: 1500, sim: 0, res: 100, shadows: 1, pseudo: '', volMaster: 100, volEffects: 100, volWeather: 100, volAmbiance: 100, volMusic: 60, fpsCap: 0, voiceMode: 1, volVoice: 100, skin: 'defaut.png', intro: true, keys: {}, layout: 'auto', leftHanded: false, touch: 'auto' };
try {
  const saved = JSON.parse(localStorage.getItem(OPT_KEY)) || {};
  if (saved.v !== 2) delete saved.dist;
  Object.assign(options, saved, { v: 2 });
} catch { /* valeurs par défaut */ }
if (!NAME_RE.test(options.pseudo)) options.pseudo = 'Joueur' + Math.floor(100 + Math.random() * 900);
if (!Number.isFinite(options.sim) || options.sim < 0 || options.sim > 256) options.sim = 0;
options.skin = skinFile(options.skin);
// touches (voir controls.js et l'écran Touches et souris)
options.keys = Controls.setBindings(options.keys);
Controls.setLayout(options.layout);
Controls.detectLayout().then(() => { renderControlKeys(); if (screen === 'keys') renderKeys(); });
const saveOptions = () => { try { localStorage.setItem(OPT_KEY, JSON.stringify(options)); } catch { /* ignoré */ } };
// objets secrets (pièces d'ordinateur) : voir /secret
setSecretItems(!!options.secret);

// Chat vocal : désactivé / appuyer pour parler / toujours actif
const voiceBtn = document.getElementById('opt-voice');
let voiceWarned = false;
function applyVoiceMode() {
  if (![0, 1, 2].includes(options.voiceMode)) options.voiceMode = 1;
  voice.mode = options.voiceMode;
  if (!voice.mode) voice.reset();
  voiceWarned = false;
  voiceBtn.textContent = `Chat vocal : ${VOICE_MODES[voice.mode]}`;
}
voiceBtn.addEventListener('click', () => {
  options.voiceMode = (options.voiceMode + 1) % 3;
  applyVoiceMode();
  saveOptions();
});
applyVoiceMode();

// ---------- Qualité graphique ----------
// torch : vraies lumières de torche (chacune se calcule pour chaque pixel) ; shadowHz : ombres
// recalculées au plus N fois par seconde quand quelque chose bouge ; minScale : résolution
// automatique minimale ; shadows : ombres (0 non, 1 normales, 2 hautes) ; hiDpi : pleine
// définition sur les écrans haute densité.
const QUALITY = [
  // (rain : part des gouttes de pluie et des flocons dessinés)
  // (upload : sommets de terrain envoyés à la carte graphique par image, au plus ; moins, c'est
  // moins d'à-coups en se déplaçant vite, le terrain lointain arrive juste un peu plus tard)
  { name: 'Bas', torch: 2, shadowHz: 15, minScale: 0.5, shadows: 1, hiDpi: false, rain: 0.4, upload: 30000 },
  { name: 'Moyen', torch: 4, shadowHz: 30, minScale: 0.6, shadows: 1, hiDpi: false, rain: 0.7, upload: 50000 },
  { name: 'Haut', torch: 8, shadowHz: 60, minScale: 0.75, shadows: 2, hiDpi: false, rain: 1, upload: 90000 },
  { name: 'Ultra', torch: 8, shadowHz: 120, minScale: 0.85, shadows: 2, hiDpi: true, rain: 1, upload: 90000 },
];
// Premier lancement : qualité devinée d'après la carte graphique et le processeur
function guessQuality() {
  let gpu = '';
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
  } catch { /* inconnue */ }
  const cores = navigator.hardwareConcurrency || 4;
  const integrated = /intel|uhd|hd graphics|iris|vega \d|radeon\(tm\) graphics|mali|adreno|swiftshader|llvmpipe|microsoft basic/.test(gpu);
  const strong = /rtx|rx \d{4}|rx 5\d\d|rx 6\d\d|rx 7\d\d|gtx 1[06-9]|gtx 16|arc a/.test(gpu);
  if (/swiftshader|llvmpipe|microsoft basic/.test(gpu) || cores <= 2) return 0;
  if (touchDevice()) return /apple/.test(gpu) ? 1 : 0; // (tablette, téléphone : la batterie et la chaleur)
  if (integrated) return cores >= 8 ? 1 : 0;
  if (strong && cores >= 6) return 3;
  return 2;
}
if (!Number.isInteger(options.quality) || !QUALITY[options.quality]) {
  options.quality = guessQuality();
  options.shadows = QUALITY[options.quality].shadows;
  if (touchDevice()) options.dist = 128; // (première partie sur tablette : moins loin)
  saveOptions();
}
if (typeof options.autoRes !== 'boolean') options.autoRes = true;
const quality = () => QUALITY[options.quality];

const sliders = {
  fov: { el: document.getElementById('opt-fov'), label: (v) => `Champ de vision : ${v}` },
  sens: { el: document.getElementById('opt-sens'), label: (v) => `Sensibilité : ${v} %` },
  dist: { el: document.getElementById('opt-dist'), label: (v) => `Distance d'affichage : ${v} blocs` },
  clouds: { el: document.getElementById('opt-clouds'), label: (v) => `Distance des nuages : ${v} blocs` },
  // chunks complets : là où le monde est vraiment simulé (eau, cultures, animaux, villages...) ;
  // au-delà, seulement le terrain simplifié (LOD). Plus loin = plus de mémoire et de calcul
  sim: { el: document.getElementById('opt-sim'), label: (v) => (v ? `Chunks simulés : ${world.fullDistance} blocs` : `Chunks simulés : automatique (${world.fullDistance} blocs)`) },
  res: { el: document.getElementById('opt-res'), label: (v) => `Résolution de rendu : ${v} %` },
  // volumes (écran Sons)
  volMaster: { el: document.getElementById('opt-volMaster'), label: (v) => `Volume général : ${v ? v + ' %' : 'coupé'}` },
  volEffects: { el: document.getElementById('opt-volEffects'), label: (v) => `Effets : ${v ? v + ' %' : 'coupés'}` },
  volWeather: { el: document.getElementById('opt-volWeather'), label: (v) => `Météo : ${v ? v + ' %' : 'coupée'}` },
  volAmbiance: { el: document.getElementById('opt-volAmbiance'), label: (v) => `Ambiance : ${v ? v + ' %' : 'coupée'}` },
  volMusic: { el: document.getElementById('opt-volMusic'), label: (v) => `Musique : ${v ? v + ' %' : 'coupée'}` },
  volVoice: { el: document.getElementById('opt-volVoice'), label: (v) => `Voix des joueurs : ${v ? v + ' %' : 'coupée'}` },
};

// Ombres : désactivées / normales (carte 1024) / hautes (carte 2048)
const SHADOW_NAMES = ['Désactivées', 'Normales', 'Hautes'];
const shadowBtn = document.getElementById('opt-shadows');
function applyShadows() {
  const q = options.shadows;
  const size = q === 2 ? 2048 : 1024;
  renderer.shadowMap.enabled = q > 0;
  sky.light.castShadow = q > 0;
  if (sky.light.shadow.mapSize.x !== size) {
    sky.light.shadow.mapSize.set(size, size);
    if (sky.light.shadow.map) { sky.light.shadow.map.dispose(); sky.light.shadow.map = null; }
  }
  scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  sky.needsShadow = true;
  shadowBtn.textContent = `Ombres : ${SHADOW_NAMES[q]}`;
}
shadowBtn.addEventListener('click', () => {
  options.shadows = (options.shadows + 1) % 3;
  applyShadows();
  saveOptions();
});

// Images par seconde illimitées : réglage de l'application, appliqué au lancement
// (Chromium ne peut désactiver la synchro verticale qu'au démarrage).
const fpsBtn = document.getElementById('opt-fps');
const nativeSettings = window.hexaNative ? window.hexaNative.getSettings() : null;
function renderFpsButton() {
  if (!nativeSettings) {
    fpsBtn.textContent = 'Images par seconde : Limitées (application uniquement)';
    fpsBtn.disabled = true;
    return;
  }
  fpsBtn.textContent = `Images par seconde : ${nativeSettings.unlimitedFps ? 'Illimitées' : 'Limitées (VSync)'}`;
}
fpsBtn.addEventListener('click', () => {
  if (!nativeSettings) return;
  nativeSettings.unlimitedFps = !nativeSettings.unlimitedFps;
  window.hexaNative.setSettings(nativeSettings);
  renderFpsButton();
  ask('Redémarrer le jeu maintenant pour appliquer ce réglage ?', 'Redémarrer', 'Plus tard').then((yes) => {
    if (!yes) { toast('Appliqué au prochain lancement du jeu'); return; }
    saveGame(false);
    window.hexaNative.relaunch();
  });
});
renderFpsButton();

// Limite d'images par seconde : aucune, 60 ou 30 (moins de chaleur et de bruit du ventilateur,
// batterie qui dure plus longtemps). Appliquée tout de suite, aussi dans un navigateur.
const FPS_CAPS = [0, 60, 30];
const fpsCapBtn = document.getElementById('opt-fpscap');
function renderFpsCap() {
  if (!FPS_CAPS.includes(options.fpsCap)) options.fpsCap = 0;
  fpsCapBtn.textContent = `Limite d'images : ${options.fpsCap ? options.fpsCap + ' par seconde' : 'Aucune'}`;
}
fpsCapBtn.addEventListener('click', () => {
  options.fpsCap = FPS_CAPS[(FPS_CAPS.indexOf(options.fpsCap) + 1) % FPS_CAPS.length];
  renderFpsCap();
  saveOptions();
});
renderFpsCap();
let nextFrameAt = 0;

// Résolution de rendu : réglage du joueur x échelle automatique (voir autoResolution)
let renderScale = 1;
function basePixelRatio() {
  const dpr = quality().hiDpi ? Math.min(devicePixelRatio, 2) : Math.min(devicePixelRatio, 1);
  return Math.min(devicePixelRatio, dpr * options.res / 100);
}
function applyPixelRatio() {
  const pr = basePixelRatio() * (options.autoRes ? renderScale : 1);
  if (Math.abs(renderer.getPixelRatio() - pr) < 0.01) return;
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight);
}

// Résolution automatique : si le jeu passe sous ~48 images/s, l'image est calculée un peu
// moins finement (puis remonte dès que ça va mieux). Le monde, lui, ne change pas.
let resClock = 0, resFrames = 0, resTime = 0;
function autoResolution(dt) {
  if (!options.autoRes || state !== 'playing') return;
  resFrames++;
  resTime += dt;
  resClock += dt;
  if (resClock < 0.75) return;
  const avg = resTime / resFrames;
  resClock = resTime = resFrames = 0;
  const prev = renderScale;
  // (avec une limite d'images, on vise cette limite : 30 images voulues ne sont pas un ralentissement)
  const want = options.fpsCap || 60;
  if (avg > 1.25 / want) renderScale = Math.max(quality().minScale, renderScale - (avg > 2 / want ? 0.12 : 0.06));
  else if (avg < 1.05 / want) renderScale = Math.min(1, renderScale + 0.03);
  // appliqué juste avant la prochaine image : changer la taille du canvas l'efface, et
  // le faire après le rendu affichait une image noire
  if (renderScale !== prev) resPending = true;
}
let resPending = false;

// Qualité graphique : Bas / Moyen / Haut / Ultra
const qualityBtn = document.getElementById('opt-quality');
const autoResBtn = document.getElementById('opt-autores');
function renderQualityButtons() {
  qualityBtn.textContent = `Qualité graphique : ${quality().name}`;
  autoResBtn.textContent = `Résolution automatique : ${options.autoRes ? 'Oui' : 'Non'}`;
}
qualityBtn.addEventListener('click', () => {
  const wasLow = options.quality === 0;
  options.quality = (options.quality + 1) % QUALITY.length;
  options.shadows = quality().shadows;
  renderScale = 1;
  applyShadows();
  applyTorchCount();
  applyPixelRatio();
  renderQualityButtons();
  saveOptions();
  if (wasLow !== (options.quality === 0)) toast('Lissage des bords : appliqué au prochain lancement du jeu');
});
autoResBtn.addEventListener('click', () => {
  options.autoRes = !options.autoRes;
  renderScale = 1;
  applyPixelRatio();
  renderQualityButtons();
  saveOptions();
});
renderQualityButtons();
// Cinématique en rejoignant un monde (oui par défaut)
if (typeof options.intro !== 'boolean') options.intro = true;
const introBtn = document.getElementById('opt-intro');
const renderIntroBtn = () => { introBtn.textContent = `Cinématique en rejoignant un monde : ${options.intro !== false ? 'Oui' : 'Non'}`; };
introBtn.addEventListener('click', () => { options.intro = options.intro === false; renderIntroBtn(); saveOptions(); });
renderIntroBtn();
// Conseils d'ORA en jeu (voir progress.js)
if (!ADVICE_LEVELS.some(([k]) => k === options.advice)) options.advice = 'some';
const adviceBtn = document.getElementById('opt-advice');
const renderAdviceBtn = () => { adviceBtn.textContent = `Conseils d'ORA : ${ADVICE_LEVELS.find(([k]) => k === options.advice)[1]}`; };
adviceBtn.addEventListener('click', () => {
  const i = ADVICE_LEVELS.findIndex(([k]) => k === options.advice);
  options.advice = ADVICE_LEVELS[(i + 1) % ADVICE_LEVELS.length][0];
  renderAdviceBtn(); saveOptions();
});
renderAdviceBtn();
// Langue (voir i18n.js) : le jeu redémarre pour l'appliquer. Le bouton est écrit dans les deux
// langues (on le trouve même si on ne lit pas celle qui est choisie)
const langBtn = document.getElementById('opt-lang');
const renderLangBtn = () => { langBtn.textContent = `Langue / Language : ${LANGS.find(([k]) => k === (options.lang || LANG))[1]}`; };
langBtn.addEventListener('click', async () => {
  const order = LANGS.map(([k]) => k);
  options.lang = order[(order.indexOf(options.lang || LANG) + 1) % order.length];
  saveOptions();
  renderLangBtn();
  if (options.lang === LANG) return;
  const yes = await ask(options.lang === 'en' ? 'Redémarrer le jeu en anglais ? / Restart the game in English?' : 'Redémarrer le jeu en français ? / Restart the game in French?', 'OK', options.lang === 'en' ? 'Plus tard / Later' : 'Plus tard / Later');
  if (yes) { if (current && state !== 'menu') saveGame(false); location.reload(); }
});
renderLangBtn();

// Au-delà, le terrain lointain est dessiné, mais les nuages, les animaux et les objets collés
// s'arrêtent (ils seraient trop petits pour se voir, et coûteraient cher)
const CLOUD_VIEW = 4000, SIM_VIEW = 640;
// (les objets collés chargés autour des joueurs ; dans l'espace, plus loin que le terrain : rien d'autre à
// calculer là-haut, et ce qu'il y a dans un coin d'espace se voit en arrivant)
const structView = () => (flight?.inVoid ? SIM_VIEW : Math.min(world.viewDistance, SIM_VIEW));
let baseFar = 450; // (portée de la caméra au sol ; elle grandit avec l'altitude, voir frame)
const SHADOW_R = 40; // (animaux qui bougent à moins de SHADOW_R blocs : les ombres sont recalculées)
function applyOptions() {
  world.viewDist = options.dist;
  world.fullDist = options.sim || 0;
  world.planKey = ''; // (le plan des chunks est refait avec les nouvelles distances)
  applyPixelRatio();
  renderer.setSize(innerWidth, innerHeight);
  const view = world.viewDistance; // chunks complets + chunks simplifiés (LOD)
  camera.fov = options.fov;
  const cloudView = Math.min(options.clouds, CLOUD_VIEW); // (réglable dans les options)
  sky.clouds.setView(cloudView);
  baseFar = camera.far = Math.max(view + 40, 450, cloudView + 40);
  camera.updateProjectionMatrix();
  scene.fog.near = view * FOG_NEAR;
  scene.fog.far = view * FOG_FAR;
  for (const [k, s] of Object.entries(sliders)) {
    s.el.value = options[k];
    s.el.nextElementSibling.textContent = s.label(options[k]);
  }
  setVolume('master', options.volMaster / 100);
  setVolume('effects', options.volEffects / 100);
  setVolume('weather', options.volWeather / 100);
  setVolume('ambiance', options.volAmbiance / 100);
  setVolume('music', options.volMusic / 100);
  voice.setVolume((options.volVoice / 100) * (options.volMaster / 100));
}
for (const [k, s] of Object.entries(sliders)) {
  s.el.addEventListener('input', () => {
    options[k] = Number(s.el.value);
    applyOptions();
    saveOptions();
  });
}
applyOptions();
applyShadows();

// ---------- Écrans ----------
// state : 'menu' (écran titre et menus), 'playing' (en jeu), 'paused' (menu du jeu)
let state = 'menu';
let current = null; // monde en cours : { id, name, type, seed, createdAt }
let screen = null;
let backTo = 'title'; // où revenir depuis Options / Commandes

function show(id) {
  // on quitte l'écran Multijoueur : la connexion par code en attente est abandonnée
  if (screen === 'multi' && id === 'title') net.cancelCodeJoin();
  if (screen === 'map' && id !== 'map') worldMap.close();
  const prev = screen;
  screen = id;
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + id));
  if (id === 'worlds') renderWorldList();
  if (id === 'create' && prev !== 'map') openCreate(); // retour de la carte : on garde le formulaire
  if (id === 'multi') { openMulti(); renderFriendWorlds(); }
  if (id === 'host') openHost();
  if (id === 'pause') updatePauseMenu();
  if (id === 'options' || id === 'controls' || id === 'credits' || id === 'wiki' || id === 'account' || id === 'support') backTo = state === 'menu' ? 'title' : 'pause';
  if (id === 'support') renderSupport();
  if (id === 'account') openAccount();
  if (id === 'friends') social.openFriends();
  if (id === 'clan') social.openClan();
  if (id === 'achievements') renderAchievements();
  if (id === 'keys') renderKeys();
  if (id === 'controls') renderControlKeys();
  if (id === 'title') { renderProfile(); skinView.start(); } else skinView.stop();
  if (id === 'wiki') wiki.open();
}
function hideScreens() {
  if (screen === 'map') worldMap.close();
  screen = null;
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
}

document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));
document.querySelectorAll('.back').forEach((b) => b.addEventListener('click', () => show(backTo)));

// ---------- Soutenir le jeu ----------
// Les pages de soutien (Ko-fi, Tipeee, itch.io…) : une entrée = un bouton. Vide : « bientôt »
// (l'application Windows n'ouvre que ces sites-là : voir app:open-url dans app/main.cjs)
const SUPPORT_LINKS = [
  // { name: 'Ko-fi', url: 'https://ko-fi.com/…' },
];
function openLink(url) {
  if (window.hexaNative?.openUrl) window.hexaNative.openUrl(url);
  else window.open(url, '_blank', 'noopener');
}
function renderSupport() {
  const box = document.getElementById('support-links');
  box.textContent = '';
  for (const l of SUPPORT_LINKS) {
    const b = document.createElement('button');
    b.textContent = '♥ ' + l.name;
    b.addEventListener('click', () => openLink(l.url));
    box.appendChild(b);
  }
  document.getElementById('support-soon').hidden = SUPPORT_LINKS.length > 0;
}

const quitBtn = document.getElementById('btn-quit');
if (window.hexaNative) quitBtn.addEventListener('click', () => window.hexaNative.quit());
else quitBtn.disabled = true;

// Échap dans un sous-menu : retour en arrière
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || state === 'playing') return;
  if (screen === 'disconnected') { show('title'); return; }
  const back = { keys: 'options', worlds: 'title', backups: 'worlds', create: 'worlds', multi: 'title', host: 'pause', options: backTo, controls: backTo, credits: backTo, support: backTo, wiki: backTo, account: backTo, achievements: 'account', sound: 'options', map: mapBack, friends: socialBack, clan: socialBack }[screen];
  if (back) show(back);
});

// ---------- Touches et souris (voir controls.js) ----------
let keyWait = null; // action dont on attend la nouvelle touche
function saveKeys() {
  options.keys = { ...Controls.bindings() };
  saveOptions();
}
function renderKeys() {
  document.getElementById('opt-layout').textContent = `Clavier : ${{ auto: `automatique (${Controls.activeLayout().toUpperCase()})`, azerty: 'AZERTY', qwerty: 'QWERTY' }[Controls.getLayout()]}`;
  document.getElementById('opt-lefthand').textContent = `Souris : ${options.leftHanded ? 'gaucher (clics inversés)' : 'droitier'}`;
  document.getElementById('opt-touch').textContent = `Commandes tactiles : ${{ auto: `automatiques (${touchDevice() ? 'oui' : 'non'})`, on: 'activées', off: 'désactivées' }[options.touch] || 'automatiques'}`;
  const list = document.getElementById('keys-list');
  list.textContent = '';
  for (const [action, name] of Controls.ACTIONS) {
    const row = document.createElement('div');
    row.className = 'key-row';
    const label = document.createElement('span');
    label.textContent = name;
    const btn = document.createElement('button');
    btn.className = 'key-btn' + (keyWait === action ? ' wait' : '') + (Controls.keyOf(action) !== Controls.DEFAULT_KEYS[action] ? ' changed' : '');
    btn.textContent = keyWait === action ? 'Appuie sur une touche…' : Controls.actionKey(action);
    btn.addEventListener('click', () => { keyWait = keyWait === action ? null : action; renderKeys(); });
    row.append(label, btn);
    list.appendChild(row);
  }
}
// (pendant l'attente, la touche va ici et nulle part ailleurs ; Échap : annuler)
addEventListener('keydown', (e) => {
  if (!keyWait || screen !== 'keys') return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (e.code === 'Escape') { keyWait = null; renderKeys(); return; }
  const action = keyWait;
  if (!Controls.rebind(action, e.code)) { toast(`La touche ${Controls.keyName(e.code)} est réservée`); return; }
  keyWait = null;
  saveKeys();
  renderKeys();
}, true);
document.getElementById('opt-layout').addEventListener('click', () => {
  const order = ['auto', 'azerty', 'qwerty'];
  options.layout = order[(order.indexOf(Controls.getLayout()) + 1) % 3];
  Controls.setLayout(options.layout);
  saveOptions();
  renderKeys();
});
document.getElementById('opt-lefthand').addEventListener('click', () => {
  options.leftHanded = !options.leftHanded;
  saveOptions();
  renderKeys();
});
document.getElementById('opt-touch').addEventListener('click', () => {
  const order = ['auto', 'on', 'off'];
  options.touch = order[(order.indexOf(options.touch) + 1) % 3];
  applyTouch();
  saveOptions();
  renderKeys();
});
document.getElementById('keys-reset').addEventListener('click', async () => {
  if (!(await ask('Remettre toutes les touches par défaut ?', 'Remettre'))) return;
  keyWait = null;
  options.keys = Controls.setBindings({});
  saveOptions();
  renderKeys();
});
// L'écran Commandes (et le Wiki, qui le reprend) montre les touches choisies
function renderControlKeys() {
  const K = Controls.actionKey;
  const text = {
    move: Controls.moveKeys(), jump: K('jump'), down: K('down'), sprint: `${K('sprint')} / ${K('forward')} ${K('forward')}`,
    drop: K('drop'), pickup: `${K('inventory')} (en visant un carton)`,
    inventory: K('inventory'), cartForward: `${K('forward')} (à bord)`, cartDown: `${K('down')} (à bord)`,
    grabAxis: `Main gravitationnelle : ${K('grabAxis')}, puis clic gauche (Maj : sens inverse)`, grabStraight: `Main gravitationnelle : ${K('grabStraight')}`,
    chat: `${K('chat')} / Entrée`, players: K('players'), voice: `${K('voice')} (maintenu)`, view: `F5 / ${K('view')}`, debug: K('debug'),
  };
  for (const dt of document.querySelectorAll('#scr-controls dt[data-k]')) if (text[dt.dataset.k]) dt.textContent = text[dt.dataset.k];
}
renderControlKeys();

// ---------- Wiki (voir wiki.js) ----------
const wiki = new Wiki({
  BLOCKS, ITEMS, RECIPES, SMELT, FUEL, COMMANDS, BIOME_NAMES, BIOME_COLORS,
  icon: (id) => items.icon(id, 64, true),
  controls: document.querySelector('#scr-controls dl'),
});

// ---------- Carte du monde (vue du dessus, voir map.js) ----------
// Exploration : les cases de EXPLORE_CELL blocs vues autour du joueur (plus loin quand il est
// en hauteur) ; en survie, la carte n'en montre pas plus. Sauvegardées avec le monde.
const EXPLORE_CELL = 16, EXPLORE_R = 48, EXPLORE_MAX = 112, EXPLORE_EVERY = 0.5;
let explored = new Set(), exploreT = 0;
function explore(dt) {
  if ((exploreT -= dt) > 0) return;
  exploreT = EXPLORE_EVERY;
  const ph = worldToHex(player.pos.x, player.pos.z), g = world.surface?.(ph.q, ph.r)?.h;
  const R = Math.min(EXPLORE_MAX, EXPLORE_R + Math.max(0, player.pos.y - (Number.isFinite(g) ? g : 64)) * 0.8);
  const cx = Math.floor(player.pos.x / EXPLORE_CELL), cz = Math.floor(player.pos.z / EXPLORE_CELL), n = Math.ceil(R / EXPLORE_CELL);
  for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
    if (Math.hypot(a, b) * EXPLORE_CELL > R + EXPLORE_CELL * 0.5) continue;
    const k = (cx + a) + ',' + (cz + b);
    if (!explored.has(k)) { explored.add(k); if (screen === 'map') worldMap.dirty = true; }
  }
}
const worldMap = new WorldMap();
let mapBack = 'title';
function openMap(back, w, me = null, weather = null, others = null, marks = null, objects = null) {
  mapBack = back;
  // (son monde, en survie : seulement ce qu'on a exploré ; une graine, le créatif : tout)
  worldMap.fog = back === 'pause' && survival.on ? { cells: explored, size: EXPLORE_CELL } : null;
  // (pas de graine à changer non plus : on verrait tout le monde)
  document.querySelector('#scr-map .map-bar').style.visibility = worldMap.fog ? 'hidden' : '';
  show('map');
  // (son monde, en créatif : un clic droit sur la carte, « Se téléporter ici »)
  worldMap.onTeleport = back === 'pause' && !survival.on ? mapTeleport : null;
  worldMap.open(w, me, weather, others, marks, objects);
}
// Réseau ferré pour la carte : les tronçons (lignes), les gares et les voitures des trains
function mapRails() {
  tracks.update();
  const lines = [];
  for (const e of tracks.edges.values()) {
    if (e.t === 'x') continue; // (une ligne spatiale va d'un astre à l'autre : pas sur la carte d'ici)
    const step = Math.max(1, Math.floor(e.pts.length / 24)), l = [];
    for (let i = 0; i < e.pts.length; i += step) l.push(e.pts[i].x, e.pts[i].z);
    const last = e.pts[e.pts.length - 1];
    l.push(last.x, last.z);
    lines.push(l);
  }
  return {
    lines,
    stations: [...tracks.stations.map((st) => ({ x: st.pos.x, z: st.pos.z, name: st.name || '' })), ...[...orbital.sites.values()].filter((b) => b.zone >= 0).map((b) => ({ x: b.x, z: b.z, name: b.name }))],
    cars: trains.cars.map((c) => ({ x: c.pos.x, z: c.pos.z, dx: c.dir.x, dz: c.dir.z, loco: c.kind === 'loco' })),
  };
}
// Objets physiques pour la carte : leur centre, et (de près) leurs colonnes vues du dessus
function mapObjects() {
  const v = new THREE.Vector3();
  return structs.list.map((s) => ({
    x: s.pos.x, z: s.pos.z,
    cells: () => {
      const seen = new Set(), out = [];
      for (const [q, r, y] of s.list) {
        const k = q + ',' + r;
        if (seen.has(k)) continue;
        seen.add(k);
        const c = hexToWorld(q, r);
        structs.toWorld(s, v.set(c.x, y + 0.5, c.z), v);
        out.push([v.x, v.z]);
      }
      return out;
    },
  }));
}
document.getElementById('map-back').addEventListener('click', () => show(mapBack));
document.getElementById('btn-map-title').addEventListener('click', () => (worldMap.rails = null) ||
  openMap('title', { gtype: 'normal', seed: randomSeed(), version: GEN_LATEST }));
document.getElementById('btn-map-create').addEventListener('click', () => {
  const s = seedInput.value.trim();
  const seed = newType === 'flat' ? '0' : s || randomSeed();
  if (newType !== 'flat' && !s) seedInput.value = seed; // la graine vue sera celle du monde créé
  openMap('create', { gtype: newType, seed, version: GEN_LATEST });
});
document.getElementById('btn-map-pause').addEventListener('click', () => flight.inVoid ? toast('Pas de carte dans l\'espace : les stations et les astres ont leur repère à l\'écran (N pour en choisir un)') : (worldMap.rails = mapRails) &&
  openMap('pause', { gtype: world.gen.type, seed: world.gen.seed, version: world.gen.version, chunkVer: world.chunkVer },
    () => ({ x: player.pos.x, z: player.pos.z, yaw: player.yaw }),
    // météo de la partie (calque de la pluie)
    { climate: sky.clouds.climate, time: () => dayCount + dayTime },
    // les autres joueurs (en ligne)
    () => [...net.remotes.values()].filter((rp) => rp.placed).map((rp) => ({ name: rp.name, x: rp.pos.x, z: rp.pos.z, yaw: rp.yaw })),
    // repères du monde (partagés en ligne)
    { list: () => waypoints, add: addWaypoint, remove: removeWaypoint },
    // objets physiques (case à cocher sur la carte)
    mapObjects));

// ---------- Repères de la carte (partagés avec les autres joueurs) ----------
// { id, x, z, n (nom), by (pseudo), c (couleur) } ; sauvegardés avec le monde. En ligne, l'hôte
// tient la liste et la renvoie à tous à chaque changement (voir net.js).
let waypoints = [];
const MAX_WAYPOINTS = 64;
const nameHue = (n) => { let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 8; };
function cleanWaypoints(list) {
  return (Array.isArray(list) ? list : []).filter((m) => m && Number.isFinite(m.x) && Number.isFinite(m.z) && typeof m.n === 'string' && m.n.trim())
    .slice(0, MAX_WAYPOINTS).map((m, i) => ({ id: Number.isInteger(m.id) ? m.id : i + 1, x: m.x, z: m.z, n: m.n.trim().slice(0, 24), by: typeof m.by === 'string' ? m.by.slice(0, 16) : '', c: Number.isInteger(m.c) ? m.c & 7 : 0 }));
}
function addWaypoint(x, z, n, by = options.pseudo) {
  if (net.isClient) { net.csend({ t: 'wpadd', x, z, n }); return; }
  if (waypoints.length >= MAX_WAYPOINTS) { toast(`${MAX_WAYPOINTS} repères au plus`); return; }
  waypoints.push({ id: waypoints.reduce((m, w) => Math.max(m, w.id), 0) + 1, x: Math.round(x), z: Math.round(z), n: n.slice(0, 24), by, c: nameHue(by) });
  waypointsChanged();
}
function removeWaypoint(id) {
  if (net.isClient) { net.csend({ t: 'wpdel', id }); return; }
  waypoints = waypoints.filter((w) => w.id !== id);
  waypointsChanged();
}
function waypointsChanged() {
  world.changed = true;
  if (net.isHost) net.broadcastJoined({ t: 'wps', l: waypoints });
  worldMap.dirty = true;
}

// ---------- Écran titre (panorama qui tourne) ----------
let titleSpot = { x: 0, y: 30, z: 0 };
let panoAngle = Math.random() * Math.PI * 2;

function enterTitle() {
  tutorial.stop();
  progress.stop();
  setSpectator(false);
  survival.setHardcore(false);
  sky.space = false;
  sky.planet = null;
  sky.viewHere = sky.viewAt = sky.viewBelow = sky.viewRocks = sky.viewQ = null;
  flight.reset();
  player.gravity = 1;
  animals.noSpawn = false;
  afk = false;
  document.body.classList.remove('afk');
  net.leave();
  closeChat(false);
  for (const l of torchLights) l.intensity = 0;
  torchSound?.setLevel(0, true); // le crépitement des torches s'arrête net
  tnt.clear();
  structs.clear();
  schem.clear();
  ropes.clear();
  animals.clear();
  hexaliens.clear();
  snowballs?.clear();
  weapons.clear();
  burnLeft = 0;
  cold = 0;
  freezing = false;
  weather.clear();
  seasons.reset();
  tornadoes.clear();
  fireFx.stop();
  frostFx.stop();
  containers.clear();
  industry.clear();
  cartons.clear();
  circuits.clear();
  nature.clear();
  structs.worldParams.clear();
  targetNames.clear();
  torchList = [];
  state = 'menu';
  current = null;
  online = null;
  survival.load(false);
  document.body.classList.remove('in-game');
  player.model.visible = false;
  outline.visible = false;
  if (player.riding) carts.dismount(player);
  carts.clear();
  trains.clear();
  engineSound(0, 0, 0); // (plus de moteur qui gronde)
  tracks.clear();
  photos.clear();
  world.setGenerator('normal', TITLE_SEED, GEN_LATEST, true); // (surface seulement : voir world.js)
  sky.setSeed(TITLE_SEED);
  const s = world.findSpawn();
  const p = hexToWorld(s.q, s.r);
  titleSpot = { x: p.x, y: s.y + 13, z: p.z };
  document.getElementById('splash').textContent = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
  show('title');
}

// ---------- Liste des mondes ----------
const listEl = document.getElementById('world-list');
let worlds = [];
let selectedId = null;

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString(LANG === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function renderWorldList() {
  worlds = Save.listWorlds().filter((w) => w.type !== 'tutorial');
  if (!worlds.some((w) => w.id === selectedId)) selectedId = worlds[0]?.id ?? null;
  listEl.innerHTML = '';
  if (!worlds.length) {
    listEl.innerHTML = '<p class="empty">Aucun monde pour l\'instant — crée ton premier monde !</p>';
  }
  for (const w of worlds) {
    const row = document.createElement('div');
    row.className = 'world' + (w.id === selectedId ? ' selected' : '') + (w.broken ? ' broken' : '');
    const ic = w.broken ? hexIcon(atlas.tiles.tnt_side || atlas.tiles.oak_log_top_cap, 48) : worldIconCanvas(w, 48);
    // clic sur l'icône : en choisir une autre
    if (!w.broken) {
      ic.title = 'Changer l\'icône';
      ic.classList.add('world-icon');
      ic.addEventListener('click', (e) => { e.stopPropagation(); pickWorldIcon(w, ic); });
    }
    row.appendChild(ic);
    const info = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = w.name;
    const l1 = document.createElement('small');
    l1.textContent = w.broken ? `${w.id} — fichier endommagé` : `${w.id} (${formatDate(w.savedAt)})`;
    const l2 = document.createElement('small');
    l2.textContent = w.broken ? "Ce monde ne peut pas s'ouvrir : restaure une copie de secours."
      : `${w.hardcore ? (w.over ? 'Hardcore (partie terminée)' : 'Hardcore') : w.mode === 'survival' ? 'Survie' : 'Créatif'}${w.cheated && w.mode === 'survival' && !w.hardcore ? ' (succès désactivés)' : ''} — monde ${w.type === 'flat' ? 'plat' : 'normal'} — graine : ${w.seed}`;
    info.append(title, l1, l2);
    row.appendChild(info);
    row.addEventListener('click', () => { selectedId = w.id; renderWorldList(); });
    row.addEventListener('dblclick', () => openWorld(w));
    listEl.appendChild(row);
  }
  const has = !!selectedId;
  for (const id of ['btn-play-world', 'btn-export', 'btn-delete', 'btn-backups']) document.getElementById(id).disabled = !has;
  if (has && selected()?.broken) document.getElementById('btn-export').disabled = true;
}

// Icônes des mondes : une texture de bloc (son nom, comme avant), un objet ('item:<id>') ou un
// astre du jeu ('body:<id>', dessiné comme vu de l'espace). Choisies dans une grille à onglets
// sous l'icône (Blocs, Objets, Astres)
const WORLD_ICONS = ['grass_top', 'oak_log_top', 'birch_log_top', 'oak_planks', 'stone', 'cobblestone', 'sand', 'snow', 'cactus_top', 'oak_leaves',
  'iron_block', 'voltite_block', 'platinum_block', 'crimsonite_block', 'fluorite_block', 'obsidian', 'lava', 'magma', 'tnt_top', 'glass', 'stone_bricks', 'red_bricks', 'marble', 'sandstone'];
function hexPath(ctx, size) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    ctx.lineTo(size / 2 + size * 0.49 * Math.cos(a), size / 2 + size * 0.49 * Math.sin(a));
  }
  ctx.closePath();
}
// un objet (son icône) sur un hexagone sombre
function hexFramed(img, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  hexPath(x, size);
  const g = x.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#26394a');
  g.addColorStop(1, '#121b24');
  x.fillStyle = g;
  x.fill();
  const s = Math.round(size * 0.72);
  x.drawImage(img, (size - s) / 2, (size - s) / 2, s, s);
  x.strokeStyle = 'rgba(0,0,0,0.5)';
  x.lineWidth = 2;
  x.stroke();
  return c;
}
// un astre de system.js, dessiné : étoile (halo), trou noir (disque), planète (couleurs du sol ou
// bandes des géantes, côté nuit, liseré d'atmosphère, anneaux)
function bodyIcon(b, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d'), m = size / 2;
  let h = 7;
  for (const ch of b.id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  const rnd = () => (h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 4294967296;
  hexPath(x, size);
  x.save();
  x.clip();
  x.fillStyle = '#05070d';
  x.fillRect(0, 0, size, size);
  x.fillStyle = '#ffffff';
  for (let i = 0; i < 12; i++) { x.globalAlpha = 0.25 + rnd() * 0.6; x.fillRect(rnd() * size, rnd() * size, 1, 1); }
  x.globalAlpha = 1;
  const k = b.kind;
  const r = size * (k === 'star' ? 0.2 : k === 'moon' || k === 'dwarf' ? 0.22 : k === 'gas' || k === 'ice' ? (b.rings ? 0.22 : 0.3) : 0.27);
  const disc = (rad) => { x.beginPath(); x.arc(m, m, rad, 0, Math.PI * 2); };
  if (k === 'star') {
    const g = x.createRadialGradient(m, m, r * 0.3, m, m, r * 2.4);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, b.color || '#fff1d0');
    g.addColorStop(0.5, b.corona || '#ffb048');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
  } else if (k === 'hole') {
    x.save();
    x.translate(m, m);
    x.rotate(-0.3);
    x.scale(1, 0.32);
    const g = x.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 2.2);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.2, b.color || '#ffb070');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(0, 0, r * 2.2, 0, Math.PI * 2);
    x.fill();
    x.restore();
    x.fillStyle = '#000';
    disc(r * 0.85);
    x.fill();
    x.strokeStyle = b.color || '#ffb070';
    x.lineWidth = 1.2;
    disc(r * 0.92);
    x.stroke();
  } else {
    const ringC = b.ringColor != null ? '#' + b.ringColor.toString(16).padStart(6, '0') : b.bands ? b.bands[1] : '#a0a0a0';
    const rings = (front) => {
      if (!b.rings) return;
      x.save();
      x.translate(m, m);
      x.rotate(-0.35);
      x.scale(1, 0.3);
      x.strokeStyle = ringC;
      for (const [a, z, al] of b.rings) {
        x.globalAlpha = Math.min(1, al + 0.25);
        x.lineWidth = (z - a) * r;
        x.beginPath();
        x.arc(0, 0, ((a + z) / 2) * r, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
        x.stroke();
      }
      x.restore();
      x.globalAlpha = 1;
    };
    rings(false);
    x.save();
    disc(r);
    x.clip();
    if (b.bands) {
      const n = b.bands.length * 2;
      for (let i = 0; i < n; i++) { x.fillStyle = b.bands[i % b.bands.length]; x.fillRect(m - r, m - r + (i * 2 * r) / n, 2 * r, (2 * r) / n + 1); }
    } else {
      const C = b.colors || {};
      x.fillStyle = C.mid || '#888888';
      x.fillRect(0, 0, size, size);
      const pal = [C.low, C.high, C.sea, C.peak, C.low].filter(Boolean);
      for (let i = 0; i < 16; i++) {
        x.fillStyle = pal[i % pal.length] || C.mid || '#888888';
        x.globalAlpha = 0.65;
        x.beginPath();
        x.arc(m - r + rnd() * 2 * r, m - r + rnd() * 2 * r, r * (0.12 + rnd() * 0.3), 0, Math.PI * 2);
        x.fill();
      }
      x.globalAlpha = 1;
    }
    // (éclairé d'en haut à gauche : côté nuit en bas à droite)
    const g = x.createRadialGradient(m - r * 0.45, m - r * 0.45, r * 0.1, m, m, r * 1.2);
    g.addColorStop(0, 'rgba(255,255,255,0.2)');
    g.addColorStop(0.55, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.8)');
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
    x.restore();
    if (b.atmo?.rim) { x.strokeStyle = b.atmo.rim; x.globalAlpha = 0.55; x.lineWidth = 1.5; disc(r + 0.8); x.stroke(); x.globalAlpha = 1; }
    rings(true);
  }
  x.restore();
  x.strokeStyle = 'rgba(0,0,0,0.5)';
  x.lineWidth = 2;
  hexPath(x, size);
  x.stroke();
  return c;
}
function worldIconCanvas(w, size) {
  const ic = typeof w.icon === 'string' ? w.icon : '';
  if (ic.startsWith('item:')) {
    const id = +ic.slice(5);
    if (ITEMS[id] || BLOCKS[id]) return hexFramed(items.icon(id, Math.round(size * 0.72), true), size);
  }
  if (ic.startsWith('body:') && BODY[ic.slice(5)]) return bodyIcon(BODY[ic.slice(5)], size);
  const t = ic && (atlas.tiles[ic + '_cap'] || atlas.tiles[ic]);
  return hexIcon(t || atlas.tiles[w.type === 'flat' ? 'grass_top_cap' : 'oak_log_top_cap'] || atlas.tiles.oak_log_top_cap, size);
}
// les choix d'un onglet : [valeur de w.icon, nom affiché]
function worldIconChoices(tab) {
  if (tab === 'bodies') return Object.values(BODY).map((b) => ['body:' + b.id, b.name]);
  if (tab === 'items') {
    return Object.entries(ITEMS).filter(([, it]) => !it.hidden && it.name).map(([id, it]) => ['item:' + id, it.name]);
  }
  const out = [], seen = new Set();
  const add = (tex, name) => { if (!tex || seen.has(tex) || !atlas.tiles[tex + '_cap']) return; seen.add(tex); out.push([tex, name]); };
  const byTop = new Map();
  for (const b of Object.values(BLOCKS)) if (typeof b.top === 'string' && !byTop.has(b.top)) byTop.set(b.top, b.name);
  for (const n of WORLD_ICONS) add(n, byTop.get(n) || n);
  for (const b of Object.values(BLOCKS)) if (!b.hidden && typeof b.top === 'string') add(b.top, b.name);
  return out;
}
let worldIconTab = 'blocks';
function pickWorldIcon(w, anchor) {
  document.getElementById('world-icons')?.remove();
  const box = document.createElement('div');
  box.id = 'world-icons';
  box.addEventListener('click', (e) => e.stopPropagation());
  const tabs = document.createElement('div');
  tabs.className = 'wi-tabs';
  const grid = document.createElement('div');
  grid.className = 'wi-grid';
  const fill = () => {
    for (const b of tabs.children) b.classList.toggle('on', b.dataset.tab === worldIconTab);
    grid.innerHTML = '';
    for (const [val, name] of worldIconChoices(worldIconTab)) {
      const c = worldIconCanvas({ icon: val, type: w.type }, 36);
      c.title = name;
      if (val === w.icon) c.classList.add('on');
      c.addEventListener('click', () => {
        box.remove();
        w.icon = val;
        if (current?.id === w.id) current.icon = val;
        if (!Save.saveWorld(w)) toast('Erreur : icône non enregistrée');
        renderWorldList();
      });
      grid.appendChild(c);
    }
  };
  for (const [tab, label] of [['blocks', 'Blocs'], ['items', 'Objets'], ['bodies', 'Astres']]) {
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset.tab = tab;
    b.addEventListener('click', () => { worldIconTab = tab; fill(); });
    tabs.appendChild(b);
  }
  // (l'onglet de l'icône actuelle)
  const cur = typeof w.icon === 'string' ? w.icon : '';
  worldIconTab = cur.startsWith('item:') ? 'items' : cur.startsWith('body:') ? 'bodies' : cur ? 'blocks' : worldIconTab;
  box.append(tabs, grid);
  fill();
  const r = anchor.getBoundingClientRect();
  box.style.left = Math.max(4, Math.min(r.left, innerWidth - 380)) + 'px';
  document.body.appendChild(box);
  const hgt = box.offsetHeight;
  box.style.top = (r.bottom + 4 + hgt > innerHeight - 4 ? Math.max(4, r.top - 4 - hgt) : r.bottom + 4) + 'px';
  grid.querySelector('canvas.on')?.scrollIntoView({ block: 'nearest' });
  setTimeout(() => addEventListener('click', () => box.remove(), { once: true }), 0);
}

// Ouvrir un monde (endommagé : on propose ses copies de secours)
function openWorld(w) {
  if (!w) return;
  if (w.broken) { openBackups(w); return; }
  playWorld(w);
}

// ---------- Copies de secours d'un monde (voir save.js et app/main.cjs) ----------
let backupsOf = null;
function openBackups(w) {
  backupsOf = w;
  show('backups');
  renderBackups();
}
function renderBackups() {
  const w = backupsOf, list = document.getElementById('backup-list');
  document.getElementById('backup-title').textContent = `Copies de secours : ${w.name}`;
  list.innerHTML = '';
  const items = Save.listBackups(w.id);
  if (!items.length) {
    list.innerHTML = '<p class="empty">Pas encore de copie de secours pour ce monde : le jeu en fait une au plus toutes les 10 minutes de jeu.</p>';
    return;
  }
  for (const b of items) {
    const row = document.createElement('div');
    row.className = 'world';
    const info = document.createElement('div');
    const t = document.createElement('b');
    t.textContent = new Date(b.time).toLocaleString(LANG === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'full', timeStyle: 'short' });
    const s = document.createElement('small');
    s.textContent = b.size ? `${Math.max(1, Math.round(b.size / 1024))} Ko` : '';
    info.append(t, s);
    const btn = document.createElement('button');
    btn.textContent = 'Restaurer';
    btn.addEventListener('click', async () => {
      if (!(await ask(`Remettre « ${w.name} » comme il était le ${t.textContent} ?\nSa version actuelle est gardée en copie de secours.`, 'Restaurer'))) return;
      if (Save.restoreBackup(w.id, b.name)) { toast('Monde restauré ✓'); selectedId = w.id; show('worlds'); }
      else toast('Erreur : cette copie est illisible');
    });
    row.append(info, btn);
    list.appendChild(row);
  }
}
document.getElementById('btn-backups').addEventListener('click', () => { if (selected()) openBackups(selected()); });

const selected = () => worlds.find((w) => w.id === selectedId);

document.getElementById('btn-play-world').addEventListener('click', () => openWorld(selected()));

document.getElementById('btn-delete').addEventListener('click', async () => {
  const w = selected();
  if (!w || !(await ask(`Supprimer « ${w.name} » ?\nIl disparaîtra de la liste (une dernière copie de secours est gardée dans le dossier des sauvegardes).`, 'Supprimer'))) return;
  Save.deleteWorld(w.id);
  selectedId = null;
  renderWorldList();
});

document.getElementById('btn-export').addEventListener('click', () => {
  const w = selected();
  if (!w) return;
  const blob = new Blob([JSON.stringify(w)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hexacraft-${w.id}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Monde exporté');
});

const fileInput = document.getElementById('file-import');
document.getElementById('btn-import').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const f = fileInput.files[0];
  fileInput.value = '';
  if (!f) return;
  try {
    const data = Save.normalize(JSON.parse(await f.text()));
    if (!data) throw new Error();
    data.id = Save.makeId(data.name);
    if (!Save.saveWorld(data)) throw new Error();
    selectedId = data.id;
    renderWorldList();
    toast(`« ${data.name} » importé ✓`);
  } catch {
    toast('Fichier de sauvegarde invalide');
  }
});

// ---------- Création de monde ----------
const nameInput = document.getElementById('in-name');
const seedInput = document.getElementById('in-seed');
const typeBtn = document.getElementById('btn-type');
const typeHint = document.getElementById('type-hint');
let newType = 'normal';

function updateType() {
  typeBtn.textContent = `Type de monde : ${newType === 'normal' ? 'Normal' : 'Plat'}`;
  typeHint.textContent = newType === 'normal'
    ? 'Collines, montagnes et arbres générés à partir de la graine.'
    : 'Un monde tout plat : bedrock, 2 couches de terre et de l\'herbe.';
  seedInput.disabled = newType === 'flat';
}
const modeBtn = document.getElementById('btn-mode');
const modeHint = document.getElementById('mode-hint');
let newMode = 'creative';
const MODE_LABEL = { creative: 'Créatif', survival: 'Survie', hardcore: 'Hardcore' };
function updateMode() {
  modeBtn.textContent = `Mode de jeu : ${MODE_LABEL[newMode]}`;
  modeHint.textContent = newMode === 'hardcore'
    ? 'La survie, mais une seule vie : mort, la partie est finie (on peut encore regarder le monde en spectateur). Dégâts plus forts, pas de créatif.'
    : newMode === 'survival'
      ? '12 cœurs, on récolte les blocs et on fabrique ses outils (E : inventaire, table de craft).'
      : 'Tous les blocs à volonté, on vole (double appui sur Espace), pas de dégâts.';
}
function openCreate() {
  nameInput.value = 'Nouveau monde';
  seedInput.value = '';
  newType = 'normal';
  newMode = 'creative';
  newNukes = true;
  updateType();
  updateMode();
  updateNukes();
  setTimeout(() => nameInput.select(), 0);
}
typeBtn.addEventListener('click', () => { newType = newType === 'normal' ? 'flat' : 'normal'; updateType(); });
const nukesBtn = document.getElementById('btn-nukes');
let newNukes = true;
const updateNukes = () => { nukesBtn.textContent = 'Charges nucléaires : ' + (newNukes ? 'autorisées' : 'interdites'); };
nukesBtn.addEventListener('click', () => { newNukes = !newNukes; updateNukes(); });
modeBtn.addEventListener('click', () => { newMode = { creative: 'survival', survival: 'hardcore', hardcore: 'creative' }[newMode]; updateMode(); });

function createWorld() {
  const name = nameInput.value.trim() || 'Nouveau monde';
  const now = new Date().toISOString();
  playWorld({
    game: 'HexaCraft', version: 2,
    id: Save.makeId(name), name, type: newType, genVersion: newType === 'flat' ? FLAT_DEEP : GEN_LATEST, mode: newMode === 'hardcore' ? 'survival' : newMode,
    ...(newMode === 'hardcore' ? { hardcore: true } : {}),
    ...(newNukes ? {} : { nukes: false }),
    seed: newType === 'flat' ? '0' : (seedInput.value.trim() || randomSeed()),
    createdAt: now, savedAt: now,
    world: { chunks: {} },
    player: { slot: 0 },
  });
}
document.getElementById('btn-create').addEventListener('click', createWorld);
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') createWorld(); });
seedInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') createWorld(); });

// ---------- Jouer / sauvegarder ----------
let lastSave = performance.now();

let departing = false; // (la navette du tutoriel part : plus de sauvegarde, voir onFinish)
function saveGame(notify) {
  if (!current || departing) return false;
  net.saveAllPlayers();
  const data = collectData();
  const ok = Save.saveWorld(data);
  if (ok) world.changed = false;
  lastSave = performance.now();
  if (notify) toast(ok ? 'Monde sauvegardé ✓' : 'Erreur : sauvegarde impossible');
  return ok;
}

// Tout le monde actuel (l'astre où l'on est), prêt à sauvegarder
function collectData() {
  const data = Save.serialize(current, world, player, slot, dayTime, hotbar, carts.serialize());
  data.world.structs = structs.serialize();
  data.world.tracks = tracks.serialize();
  data.world.trains = trains.serialize();
  data.world.scoreboard = commands.sb.serialize();
  data.world.ropes = ropes.serialize();
  data.world.animals = animals.serialize();
  data.world.hexaliens = hexaliens.serialize(); // (ceux des œufs)
  data.world.waypoints = waypoints;
  data.world.containers = containers.serialize();
  data.world.industry = industry.serialize();
  data.world.heat = seasons.saveHeat(); // (gâteaux chauffants, réchauffement)
  data.world.photos = photos.serialize();
  data.world.radio = circuits.serializeRadio(); // (fréquences sans fil)
  data.world.cartLoads = cartLoads.serialize(); // (chargements des Hexacarts)
  data.world.ghosts = schem.serialize(); // (projections des schématiques)
  if (current.icon) data.icon = current.icon;
  data.world.cartons = cartons.serialize();
  data.world.phys = [...structs.worldParams];
  data.world.targets = [...targetNames];
  data.world.spaces = flight.serialize(); // (les bulles de l'espace, voir spaceflight.js)
  data.world.orbital = orbital.serialize();
  data.world.weapons = weapons.serialize(); // (boucliers posés, charge des accumulateurs)
  if (survival.on) { data.player.inv = survival.saveInv(); data.player.health = survival.health; data.player.hunger = survival.hunger; }
  data.player.head = survival.head?.id || 0;
  if (playerTeam) data.player.team = playerTeam;
  if (capGiven) data.world.capGiven = true;
  // affaires de l'autre mode (voir /gamemode)
  if (modeStash.hotbar || modeStash.inv) data.player.stash = survival.on ? { hotbar: modeStash.hotbar } : { inv: modeStash.inv };
  if (current.players) data.players = current.players;
  data.days = dayCount;
  data.timeLock = timeLock; // (jour / nuit éternels)
  data.explored = [...explored].join(';'); // (carte : ce qu'on a exploré)
  if (tutorial.on && inTuto()) data.tuto = tutorial.save();
  if (progress.on) data.progress = progress.save();
  if (current.wreck) data.wreck = current.wreck; // (l'épave du vaisseau, posée une fois)
  if (current.hostMode) data.hostMode = current.hostMode; // (le mode de l'hôte, s'il a changé en ligne)
  if (current.cheated) data.cheated = true; // (passé en créatif : plus de succès dans ce monde)
  if (current.hardcore) data.hardcore = true; // (une seule vie)
  if (current.noNukes) data.nukes = false;   // (charges nucléaires interdites)
  if (current.noVehicleDamage) data.vehicleDamage = false; // (/worldrule degatVehicule false)
  if (current.infiniteFuel) data.infiniteFuel = true; // (règle du monde : carburant des fusées infini)
  if (current.over) data.over = true;         // (hardcore : mort, la partie est finie)
  if (current.noRank) data.noRank = true;    // (/voie utilisée : plus de classements)
  sky.clouds.climate.prune(dayCount + dayTime);
  data.pressures = sky.clouds.climate.pressures; // (centres de pression de /weather)
  return data;
}

let loadStart = 0;
let tutoState = null; // (le tutoriel à reprendre une fois le monde chargé)

function playWorld(data) {
  data = mergeOldSpace(data);
  loadVillagerVoices(PHRASE_KEYS); // (voix des villageois : prêtes avant qu'ils parlent)
  document.getElementById('loading-text').textContent =
    data.world && Object.keys(data.world.chunks).length ? 'Chargement du monde…' : 'Génération du terrain…';
  show('loading');
  // la cinématique d'arrivée (le monde se charge derrière) ; la première fois dans ce monde, on
  // se réveille ensuite dans l'épave du vaisseau (voir buildWreck)
  wreckPending = options.intro !== false && !data.wreck && data.player?.x === undefined && data.type !== 'tutorial';
  if (wreckPending) startIntro(false, data.seed); // (un monde où l'on est déjà venu : pas de cinématique)
  // on laisse l'écran de chargement s'afficher, puis les threads génèrent les environs
  setTimeout(() => {
    tutoState = data.type === 'tutorial' ? (data.tuto || { step: 0 }) : null;
    // (le ciel, la gravité : selon la zone de la carte où l'on est, voir flight.syncZone)
    sky.space = data.type === 'tutorial'; // (l'espace, en orbite autour de PXT-1 : voir tutoSky)
    // (tutoriels : pas de terrain simplifié, la station et ses abords toujours en détail complet)
    world.noLod = data.type === 'tutorial';
    world.planKey = null;
    sky.planet = null;
    sky.viewSeed = data.seed;
    sky.viewHere = sky.viewAt = sky.viewBelow = sky.viewRocks = sky.viewQ = null;
    animals.noSpawn = data.type === 'tutorial';
    player.gravity = 1;
    airWarned = false;
    current = { id: data.id, name: data.name, type: data.type, seed: data.seed, genVersion: data.genVersion ?? 1, mode: data.mode === 'survival' ? 'survival' : 'creative', createdAt: data.createdAt, players: data.players || {}, wreck: data.wreck || null, hostMode: data.hostMode === 'survival' || data.hostMode === 'creative' ? data.hostMode : undefined };
    // (un monde qui a été en créatif : succès désactivés pour toujours)
    current.cheated = !!data.cheated || current.mode === 'creative' || current.hostMode === 'creative';
    current.noRank = !!data.noRank;
    // mode hardcore : une seule vie ; over : la partie est finie (on ne fait plus que regarder)
    current.hardcore = !!data.hardcore;
    current.noNukes = data.nukes === false; // (charges nucléaires interdites dans ce monde)
    current.infiniteFuel = !!data.infiniteFuel;
    rockets.infinite = current.infiniteFuel;
    current.noVehicleDamage = data.vehicleDamage === false;
    structs.noDamage = current.noVehicleDamage; // (véhicules indestructibles : voir /worldrule)
    if (typeof data.icon === 'string') current.icon = data.icon;
    current.over = current.hardcore && !!data.over;
    Save.applyToWorld(data, world, player);
    const saved = data.player.hotbar;
    hotbar = Array.isArray(saved) && saved.length >= 9 ? fitHotbar(saved) : defaultHotbar();
    survival.load((current.hostMode || current.mode) === 'survival', data.player.inv, data.player.health, data.player.hunger);
    survival.setHardcore(current.hardcore);
    if (data.type === 'tutorial') progress.stop(); else progress.start(data.progress);
    setSpectator(current.over);
    survival.head = Number.isInteger(data.player.head) && ITEMS[data.player.head]?.wear ? makeSlot(data.player.head, 1) : null;
    playerTeam = teamOf(data.player.team) ? data.player.team : null;
    capGiven = !!data.world.capGiven;
    wearSync();
    if (survival.on) player.fly = false;
    const stash = data.player.stash || {};
    modeStash = { hotbar: Array.isArray(stash.hotbar) ? stash.hotbar : null, inv: Array.isArray(stash.inv) ? stash.inv : null };
    player.riding = null;
    leavePilot(true);
    carts.load(data.world.carts);
    tracks.load(data.world.tracks);
    // (les objets avant les trains : structs.load vide la liste, plateaux des wagons plats compris)
    structs.load(data.world.structs);
    trains.load(data.world.trains);
    cartLoads.load(data.world.cartLoads);
    ropes.load(data.world.ropes);
    animals.load(data.world.animals);
    hexaliens.clear();
    hexaliens.load(data.world.hexaliens);
    waypoints = cleanWaypoints(data.world?.waypoints);
    containers.load(data.world.containers);
    industry.scan(world.mods, CS, -Y_MIN);
    industry.load(data.world.industry);
    orbital.clear();
    orbital.scan(world.mods, CS, -Y_MIN);
    seasons.loadHeat(data.world.heat);
    photos.load(data.world.photos);
    schem.load(data.world.ghosts);
    cartons.load(data.world.cartons);
    setAutoCollect(false, true);
    structs.worldParams = new Map((Array.isArray(data.world.phys) ? data.world.phys : []).filter((e) => Array.isArray(e) && typeof e[0] === 'string' && Array.isArray(e[1]) && ((e[1].length === 3 && e[1].every(Number.isFinite)) || validGrav(e[1]))));
    targetNames = new Map((Array.isArray(data.world.targets) ? data.world.targets : []).filter((e) => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string').map(([k, n]) => [k, n.slice(0, TARGET_NAME_MAX)]));
    circuits.clear();
    circuits.loadRadio(data.world.radio);
    player.standingOn = player.attached = player.aboard = null;
    renderHotbar();
    selectSlot(data.player.slot ?? 0, true);
    dayTime = Number.isFinite(data.time) ? data.time : 0.05;
    dayCount = Number.isInteger(data.days) ? data.days : 0;
    timeLock = Number.isFinite(data.timeLock) ? Math.max(0, Math.min(0.999, data.timeLock)) : null;
    explored = new Set(typeof data.explored === 'string' && data.explored ? data.explored.split(';').filter((k) => /^-?\d+,-?\d+$/.test(k)) : []);
    sky.setSeed(data.seed);
    sky.clouds.climate.setPressures(data.pressures); // (après la graine : elle recrée le climat)
    flight.load(data.world.spaces, data.type !== 'tutorial');
    orbital.load(data.world.orbital);
    weapons.load(data.world.weapons);
    commands.reset(data.world.scoreboard);
    viewMode = 0;
    state = 'loading';
    loadStart = performance.now();
  }, 30);
}

// Environs prêts (ou délai dépassé) : on entre dans le monde
function finishLoading() {
  if (player.collides()) player.spawn();
  placeOldFlight();
  weather.warmUp(renderer, scene, camera);
  saveGame(false);
  state = 'paused';
  document.body.classList.add('in-game');
  hideScreens();
  if (!introOn) lock(); // (pendant la cinématique : au clic qui la termine)
  if (tutoState) {
    // la première fois : debout dans la cabine, tourné vers la porte
    // (le chapitre 2 : dans l'atelier, tourné vers la ligne de production)
    if (!tutoState.step && !tutorial.on) {
      if (tutoState.chapter === 2) { player.pos.set(STATION_SPOTS.start2.x, STATION_Y + 1, STATION_SPOTS.start2.z); player.vel.set(0, 0, 0); player.yaw = Math.PI; player.pitch = 0; }
      else { player.spawn(); player.yaw = -Math.PI / 2; }
    }
    tutorial.start(tutoState);
    tutoState = null;
  }
}

// ---------- Cinématique d'arrivée (voir intro.js) ----------
let introOn = false;
let introPod = false; // (après la cinématique : la capsule, voir startPod)
function startIntro(pod = false, introSeed = current?.seed ?? '0') {
  if (introOn) return;
  introOn = true;
  introPod = pod;
  if (document.pointerLockElement) document.exitPointerLock();
  playIntro({
    atlas, // (les textures du jeu : astéroïdes, vaisseau en blocs)
    sample: (b) => planetSample(b, introSeed), seed: introSeed, // (les planètes d'après leur vrai terrain)
    pod, // (joueurs qui rejoignent : la capsule larguée du HEXA-9)
    isReady: () => state !== 'loading',
    onDone: (info) => {
      introOn = false;
      if (state !== 'paused') return;
      hideScreens();
      if (introPod) { wreckPending = false; startPod(); return; }
      const side = info?.side === -1 ? -1 : 1;
      if (wreckPending && current && !current.wreck && !net.isClient) {
        // la première fois dans ce monde : l'écrasement continue pour de vrai, sur son terrain
        document.body.classList.add('cutscene');
        playMusic('danger', 0.8);
        crashScene = playCrash({
          scene, world, atlas, side, center: player.pos.clone(),
          onRest: (at) => { try { buildWreck({ ...at, side }); } catch (e) { console.error('épave', e); } },
          onEnd: () => { crashScene = null; document.body.classList.remove('cutscene'); stopMusic(3); playSting('wake'); wakeUp(true); lock(); },
        });
      } else { stopMusic(3); wakeScreen(() => { playSting('wake'); wakeUp(false); lock(); }); }
      wreckPending = false;
    },
  });
}
let crashScene = null; // (l'écrasement en cours dans le monde, voir crash.js)

// ---------- Fusées : aux commandes (voir rocket.js) ----------
const pilotInput = { toggleLevel: false, toggleFA: false };
let rocketHud = null;
// (quelqu'un d'autre pilote déjà cette fusée ? l'hôte le sait ; un invité, l'hôte le lui dit : rkbusy)
function otherPilot(s) {
  return net.isClient ? null : net.proxies().find((p) => p.pilot?.s === s) || null;
}
function pilotBusy() {
  if (!player.pilot || player.pilot.passenger) return;
  leavePilot(true);
  toast('Quelqu\'un pilote déjà cette fusée : assieds-toi sur un siège passager');
}
function sitPilot(s, k) {
  if (otherPilot(s)) { toast('Quelqu\'un pilote déjà cette fusée : assieds-toi sur un siège passager'); return; }
  if (player.riding) carts.dismount(player);
  player.pilot = { s, k };
  mouse.left = mouse.right = false; // (un clic resté enfoncé en s'asseyant ne doit pas continuer à agir)
  stopMining();
  player.fly = false;
  player.vel.set(0, 0, 0);
  structs.wake(s);
  const R = s.rocket;
  const why = !R?.nozzles.length ? 'pas de moteur (tuyère, réacteur classique, chimique, plasma, ionique…)' : !R.reactors && !R.self.length ? 'pas de réacteur au nédrolytium (ou un moteur qui marche seul : réacteur chimique, propulseur ionique)'
    : !R.armed && !R.self.length ? 'le réacteur doit toucher un bloc de nédrolytium' : !R.cap && !R.ion ? 'pas de réservoir de fusée' : null;
  toast(why ? 'Poste de pilotage : ' + why : 'Aux commandes : Z / S les gaz, X couper, flèches pencher, Q / D tourner, R verticale auto, Maj se lever');
  flight.remoteHud = null;
  showRocketHud(true);
}
// Volant d'une voiture (voir cars.js) : on s'y assoit et on conduit (l'hôte, ou seul : la voiture
// est simulée chez lui)
function sitDriver(s, k) {
  if (net.isClient) { toast("En ligne, seul l'hôte peut conduire une voiture pour l'instant"); return; }
  if (net.proxies().some((p) => p.pilot?.s === s) || s.drive?.active) { toast("Quelqu'un conduit déjà cette voiture"); return; }
  if (player.riding) carts.dismount(player);
  player.pilot = { s, k, car: true };
  mouse.left = mouse.right = false;
  stopMining();
  player.fly = false;
  player.vel.set(0, 0, 0);
  structs.wake(s);
  const C = s.car;
  const why = !C ? 'pas de roue sous la voiture' : !C.lv ? 'les roues ne reçoivent pas de courant (un levier, un bloc de voltite, un fil)' : null;
  toast((why ? 'Volant : ' + why + '. ' : 'Au volant : ') + 'Z / S accélérer, freiner, reculer · Q / D tourner · Espace freiner · molette ou R / F : puissance du levier · Maj se lever');
  showRocketHud(true);
}
function driveCar() {
  const s = player.pilot.s, on = state === 'playing';
  const f = on && Controls.held(keys, 'forward'), b = on && Controls.held(keys, 'back');
  const l = on && Controls.held(keys, 'left'), r = on && Controls.held(keys, 'right');
  s.drive = { active: true, thr: (f ? 1 : 0) - (b ? 1 : 0), steer: (l ? 1 : 0) - (r ? 1 : 0), brake: on && Controls.held(keys, 'jump') };
  if (s.drive.thr || s.drive.steer) structs.wake(s);
}
// Au volant : les leviers analogiques de la voiture d'un cran de plus (d = 1) ou de moins (d = -1),
// sans se lever (molette, R / F)
function carPower(d) {
  const s = player.pilot.s;
  const levers = [...s.blocks].filter(([, id]) => isAnalog(id));
  if (!levers.length) { toast('Pas de levier analogique dans la voiture : la puissance ne se règle pas depuis le volant'); return; }
  if (net.isClient) { toast("En ligne, seul l'hôte peut régler le levier depuis le volant"); return; }
  let lv = 0, moved = false;
  for (const [k, id] of levers) {
    const v = Math.max(0, Math.min(15, id - ANALOG + d));
    if (ANALOG + v !== id) { s.blocks.set(k, ANALOG + v); moved = true; }
    lv = Math.max(lv, v);
  }
  if (moved) { structs.afterEdit(s); structs.wake(s); playClick(); }
  toast('Levier' + (levers.length > 1 ? 's' : '') + ' de la voiture : ' + lv + ' / 15' + (lv === 15 ? ' (pleine puissance)' : lv ? '' : ' (coupé)'));
}
function updateCarHud(s) {
  if (!rocketHud) return;
  const C = s.car, v = C ? Math.abs(C.v) : 0, D = s.drive;
  const bar = (x) => '<span class="rk-bar thr"><i style="width:' + Math.round(Math.max(0, Math.min(1, x)) * 100) + '%"></i></span>';
  rocketHud.innerHTML = '<b>Voiture</b>' +
    '<div>Vitesse ' + bar(v / CAR_VMAX) + ' ' + Math.round(v * 3.6) + ' km/h' + (C && C.v < -0.3 ? ' (marche arrière)' : '') + '</div>' +
    '<div>Puissance des roues : ' + (C ? C.lv : 0) + ' / 15' + (C && !C.lv ? ' <span class="bad">(pas de courant)</span>' : '') + ' · ' + (C ? C.wheels : 0) + ' roue' + (C?.wheels > 1 ? 's' : '') + '</div>' +
    (D?.brake ? '<div>Freinage</div>' : '') +
    '<div class="rk-hint">Z / S · Q / D · Espace : frein · molette ou R / F : puissance · Maj : se lever</div>';
}
// Siège passager : assis, emporté avec la fusée (comme le pilote), sans commandes
function sitPassenger(s, k) {
  if (player.riding) carts.dismount(player);
  player.pilot = { s, k, passenger: true };
  mouse.left = mouse.right = false;
  stopMining();
  player.fly = false;
  player.vel.set(0, 0, 0);
  toast('Siège passager : Maj pour se lever');
}
function leavePilot(silent = false) {
  const P = player.pilot;
  if (!P) return;
  player.pilot = null;
  // (un passager ne coupe pas les gaz du pilote ; le conducteur qui se lève laisse le frein à main)
  if (P.car) P.s.drive = null;
  else if (!P.passenger) { if (net.isClient) net.csend({ t: 'rkoff' }); else rockets.release(P.s); }
  showRocketHud(false);
  if (!silent && structs.list.includes(P.s)) {
    // (on se lève sur le poste, et on reste attaché à la fusée)
    seatAt(P.s, P.k);
    player.attached = P.s;
  }
}
function seatAt(s, k) {
  rockets.seat(s, k, player.pos);
  player.vel.copy(s.vel);
}
function seatPilot() {
  const P = player.pilot;
  const id = P.s.blocks.get(P.k);
  if (!structs.list.includes(P.s) || (P.car ? !isCarSeat(id) : id !== (P.passenger ? PASSENGER_SEAT : COCKPIT))) { leavePilot(true); toast(P.car ? 'Le volant a disparu' : P.passenger ? 'Le siège a disparu' : 'Le poste de pilotage a disparu'); return; }
  seatAt(P.s, P.k);
  player.onGround = true;
  if (P.car) updateCarHud(P.s);
  else if (!P.passenger) updateRocketHud(P.s);
}
function pilotRocket(dt) {
  const s = player.pilot.s, on = state === 'playing';
  const i = {
    up: on && Controls.held(keys, 'forward'), down: on && Controls.held(keys, 'back'),
    left: on && Controls.held(keys, 'left'), right: on && Controls.held(keys, 'right'), cut: on && keys.has('KeyX'),
    tiltF: on && keys.has('ArrowUp'), tiltB: on && keys.has('ArrowDown'), tiltL: on && keys.has('ArrowLeft'), tiltR: on && keys.has('ArrowRight'),
    toggleLevel: pilotInput.toggleLevel, toggleFA: pilotInput.toggleFA,
  };
  // (dans l'espace, R / F tenus : le nez vers l'avant, vers l'arrière de la trajectoire)
  const aim = !on || !flight.inVoid ? 0 : keys.has('KeyR') ? 1 : keys.has('KeyF') ? -1 : 0;
  if (net.isClient) {
    // (la fusée est simulée chez l'hôte : on lui envoie les commandes)
    pilotInput.clock = (pilotInput.clock || 0) - dt;
    if (pilotInput.clock <= 0 || i.toggleLevel || i.toggleFA) {
      pilotInput.clock = 0.05;
      const b = (i.up ? 1 : 0) | (i.down ? 2 : 0) | (i.left ? 4 : 0) | (i.right ? 8 : 0) | (i.cut ? 16 : 0) | (i.tiltF ? 32 : 0) | (i.tiltB ? 64 : 0) | (i.tiltL ? 128 : 0) | (i.tiltR ? 256 : 0) | (aim > 0 ? 512 : aim < 0 ? 1024 : 0);
      net.csend({ t: 'rk', id: s.id, b, yaw: player.yaw, pitch: player.pitch, ...(i.toggleLevel ? { l: 1 } : {}), ...(i.toggleFA ? { fa: 1 } : {}) });
    }
  } else rockets.control(s, { ...i, aim: flight.aimFor(s, aim) }, player.yaw, dt, player.pitch);
  pilotInput.toggleLevel = pilotInput.toggleFA = false;
}
function showRocketHud(on) {
  if (on && !rocketHud) {
    rocketHud = document.createElement('div');
    rocketHud.id = 'rocket-hud';
    document.body.appendChild(rocketHud);
  }
  if (rocketHud) rocketHud.hidden = !on;
}
function updateRocketHud(s) {
  const h = rockets.hud(s);
  if (!rocketHud || !h) return;
  // (invité : c'est l'hôte qui connaît le carburant, les gaz, la vitesse)
  const R = net.isClient ? flight.remoteHud : null;
  if (R) { h.fuel = +R.f || 0; h.cap = +R.c || h.cap; h.throttle = +R.h || 0; h.v = +R.v || 0; h.vy = +R.vy || 0; h.warp = !!R.g; }
  const bar = (v, cls = '') => '<span class="rk-bar ' + cls + '"><i style="width:' + Math.round(Math.max(0, Math.min(1, v)) * 100) + '%"></i></span>';
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  rocketHud.innerHTML =
    '<b>Fusée</b>' +
    (h.warp ? '<div>Gaz : <b style="color:#c48cff">moteurs en mode saut</b></div>' : '<div>Gaz ' + bar(h.throttle, 'thr') + ' ' + Math.round(h.throttle * 100) + ' %</div>') +
    (rockets.infinite ? '<div class="rk-hint">Carburant infini (/worldrule)</div>' : '') +
    '<div>Carburant ' + bar(h.cap ? h.fuel / h.cap : 0, 'fuel') + ' ' + fmt(h.fuel) + ' / ' + fmt(h.cap) + ' mB</div>' +
    '<div>Poussée / poids : <b class="' + (h.twr > 1 ? 'ok' : 'bad') + '">' + (Number.isFinite(h.twr) ? h.twr.toFixed(2) : '∞') + '</b> (' + h.active + '/' + h.nozzles + ' moteurs, ' + h.armed + '/' + h.reactors + ' réacteur' + (h.reactors > 1 ? 's' : '') + ' armé' + (h.armed > 1 ? 's' : '') + ')</div>' +
    (flight.inVoid ? '' : '<div>Altitude ' + fmt(h.alt) + ' · vitesse ' + h.v.toFixed(1) + ' b/s (' + (h.vy >= 0 ? '+' : '') + h.vy.toFixed(1) + ')</div>' +
    '<div>Inclinaison ' + Math.round((h.tilt * 180) / Math.PI) + '°' + (h.level ? ' · verticale auto' : '') + '</div>' +
    '<div>Assistance de vol (G) : ' + (h.fa ? '<b class="ok">active</b>' : '<b class="bad">coupée</b>') + '</div>' +
    (h.alt > 200 ? '<div class="rk-hint">L\'espace : au-dessus de ' + fmt(SPACE_Y) + '</div>' : ''));
}
// ---------- L'espace (voir spaceflight.js, spacegen.js et system.js) ----------
const flight = new SpaceFlight({
  player, structs, rockets, world, sky, camera, scene, toast, tracks, canvas: renderer.domElement,
  carryFx: (from, to, dq, r, dv) => fx.carry(from, to, dq, r, dv),
  get net() { return net; },
  survival: () => survival,
  day: () => dayCount + dayTime,
  seed: () => current?.seed ?? '0',
  onZone: () => { airWarned = false; },
});
// la gravité d'un vaisseau : on marche sur son plancher, dans son repère (voir shipframe.js)
let shipFrame = null;
structs.gravityOf = (s) => (flight.on ? (orbital.gravFor(s) ? 1 : flight.gravityAt(s.pos.x, s.pos.z, s.pos.y)) : 1);
// (hélice posée dans le monde : la puissance reçue d'un levier analogique, voir circuits.level)
structs.propLevel = (q, r, y) => circuits.propLvl.get(q + ',' + r + ',' + y) ?? circuits.level(q, r, y); // (juste après un chargement : le cran se lit directement)
// (stations et vaisseaux automatisés)
const orbital = new Orbital({
  world, structs, rockets, flight, weapons, industry, containers, circuits, player, scene, toast, cartons,
  get net() { return net; },
  survival: () => survival,
  dayTime: () => dayTime,
  day: () => dayCount + dayTime,
  held: () => hotbar[slot] || 0,
  itemName,
  openPanel: () => {
    physTarget = { orb: true };
    state = 'phys';
    keys.clear();
    mouse.left = mouse.right = false;
    show('orb');
    document.exitPointerLock();
  },
  closePanel: () => closePhys(false),
  // (noyau de station sur un objet collé : on repose l'objet, comme à la Super colle)
  reposeStruct: (s) => { if (net.isClient) { net.csend({ t: 'sdis', id: s.id }); return true; } return structs.disassemble(s); },
});
industry.solarW = (q, r, y) => orbital.solarW(q, r, y);
industry.orbUse = (k, id) => orbital.useW(k, id);
structs.noCeiling = () => flight.on; // (aucune limite de hauteur)
rockets.airTopAt = (x, z) => (flight.on ? flight.airTopAt(x, z) : SPACE_Y);
rockets.inSpace = (s) => flight.on && zoneOfXZ(s.pos.x, s.pos.z) < 0;
animals.noSpawnAt = (p) => flight.on && zoneOfXZ(p.pos.x, p.pos.z) < 0; // (dans l'espace)
// (sur une autre planète : ses créatures, voir creatures.js ; null : Hexa)
animals.onSurface = (p) => !flight.on || zoneOfXZ(p.pos.x, p.pos.z) >= 0; // (sur le sol d'un astre, pas dans l'espace)
animals.planetAt = (p) => { if (!flight.on) return null; const z = zoneOfXZ(p.pos.x, p.pos.z); return z > 0 ? zoneBody(z)?.id || null : null; };

// Couleur des cases d'une planète vue de l'espace (voir planetview.js) : son vrai terrain. Hexa :
// les biomes du générateur normal (comme la carte du monde) ; les autres : leur relief.
const OCEANS = new Set([BIOME.OCEAN, BIOME.SEA, BIOME.RIVER, BIOME.LAKE]);
function planetSample(b, seed = current?.seed ?? '0') {
  if (b.kind === 'home') {
    const gen = new Generator('normal', seed, H, GEN_LATEST), span = spanOf(b);
    return (d) => {
      const w = dirToWorld(d, span), c = gen.columnAt(w.x, w.z), col = BIOME_COLORS[c.biome] || BIOME_COLORS[3];
      const sea = OCEANS.has(c.biome);
      const hex = '#' + ((1 << 24) | (col[0] << 16) | (col[1] << 8) | col[2]).toString(16).slice(1);
      return { color: c.snow ? '#eef4f8' : hex, h: sea ? 0 : 0.004 + Math.max(0, Math.min(1, (c.h - 60) / 80)) * 0.02, sea };
    };
  }
  if (!b.land || !b.gen) return null;
  const gen = new Generator('planet:' + b.id, seed, H, GEN_LATEST), span = spanOf(b);
  return (d) => {
    const w = dirToWorld(d, span), h = worldToHex(w.x, w.z), c = gen.planet.colorAt(h.q, h.r);
    return { color: c.color, h: c.sea || c.glow ? 0 : 0.004 + c.k * 0.022, sea: c.sea, glow: c.glow };
  };
}

// Les sauvegardes d'avant la carte unique : chaque astre visité était un monde à part (data.space).
// Leurs blocs et leurs objets rejoignent leur zone ; les fusées en vol reviennent à leur départ.
let oldFlight = null;
function mergeOldSpace(data) {
  oldFlight = null;
  const sp = data.space && typeof data.space === 'object' ? data.space : null;
  if (!sp) return data;
  const out = { ...data, world: { ...data.world, chunks: { ...data.world.chunks }, structs: [...(data.world.structs || [])], spaces: [...(data.world.spaces || [])] } };
  delete out.space;
  let n = 0;
  for (const [id, d] of Object.entries(sp.bodies && typeof sp.bodies === 'object' ? sp.bodies : {})) {
    if (!Save.isValid(d)) continue;
    let dq = 0, dr = 0;
    if (id.startsWith('site:')) {
      const p = id.split(':'), c = [+p[2], +p[3], +p[4]];
      if (!BODY[p[1]] || !c.every(Number.isFinite)) continue;
      const slot = slotAt(3900 + (n % 100), 3900 + Math.floor(n / 100));
      n++;
      dq = slot.q0; dr = slot.r0;
      out.world.spaces.push({ i: slot.ix, j: slot.iz, ref: p[1], c, q: [0, 0, 0, 1], v: [0, 0, 0], a: 1 });
    } else if (BODY[id]?.gen) dq = bodyZone(id) * ZONE;
    else continue;
    const shiftKey = (k) => { const [a, b] = k.split(',').map(Number); return (a + dq / CS) + ',' + (b + dr / CS); };
    for (const [k, v] of Object.entries(d.world.chunks || {})) out.world.chunks[shiftKey(k)] = v;
    const dx = dq + dr / 2, dz = dr * (Math.sqrt(3) / 2);
    for (const e of d.world.structs || []) out.world.structs.push({ ...e, id: 1e6 + out.world.structs.length, x: e.x + dx, z: e.z + dz });
    if (sp.at === id && d.player) out.player = { ...d.player, x: (d.player.x ?? 0) + dx, z: (d.player.z ?? 0) + dz };
  }
  if (sp.flight && Array.isArray(sp.flight.b)) oldFlight = sp.flight;
  return out;
}
function placeOldFlight() {
  const f = oldFlight;
  oldFlight = null;
  if (!f) return;
  try {
    const blocks = f.b.filter((e) => Array.isArray(e) && e.length === 4 && e.every(Number.isInteger) && BLOCKS[e[3]]);
    if (!blocks.length) return;
    const at = f.pad && zoneOfXZ(+f.pad.x || 0, +f.pad.z || 0) === 0 ? f.pad : player.pos;
    const s = structs.create(++structs.nextId, +at.x || 0, Math.min(SPACE_Y - 80, +at.y || 300), +at.z || 0, null, blocks);
    for (const e of Array.isArray(f.p) ? f.p : []) if (Array.isArray(e) && typeof e[0] === 'string' && Array.isArray(e[1]) && e[1].every(Number.isFinite)) s.params.set(e[0], e[1]);
    structs.updateMotor(s);
    rockets.setFuel(s, +f.fuel || 0);
    for (const [lk, c] of Array.isArray(f.boxes) ? f.boxes : []) if (typeof lk === 'string') containers.loadOne('S' + s.id + ':' + lk, c);
    s.vel.set(0, -12, 0);
    structs.wake(s);
  } catch (e) { console.error('fusée', e); }
}
// un objet physique monté trop haut (voir ALT_MAX dans structs.js)
structs.onPowerCut = () => addChat('Un objet a dépassé 500 blocs d\'altitude : ses blocs physiques s\'éteignent et sa voltite est détruite. Il retombe !', 'sys');

// ---------- La capsule (joueurs qui rejoignent une partie, /intromulti) ----------
// On s'écrase dans l'eau près du point d'apparition avec un micro-vaisseau ; les autres joueurs
// le voient tomber (le plan part en ligne, chacun le joue), l'hôte le pose en vrais blocs et on
// se réveille debout sur son toit. Voir planPod et playPod dans crash.js.
function startPod() {
  const s = world.findSpawn(), c = hexToWorld(s.q, s.r);
  const plan = planPod(world, { x: c.x, z: c.z });
  if (net.isClient) net.csend({ t: 'pod', ...plan });
  else if (net.isHost) net.broadcastJoined({ t: 'pod', ...plan });
  document.body.classList.add('cutscene');
  crashScene = playPod({
    scene, atlas, plan, own: true, ear: () => listener,
    onRest: (blocks) => { if (!net.isClient) placePod(blocks); },
    onEnd: (at) => {
      crashScene = null;
      document.body.classList.remove('cutscene');
      stopMusic(3);
      playSting('wake');
      player.pos.set(at.x, at.y, at.z);
      player.vel.set(0, 0, 0);
      player.fly = false;
      wakeUp(false);
      setTimeout(() => addChat('Tu te réveilles sur ta capsule de secours, qui flotte sur l\'eau. Rejoins la rive…', 'sys'), 3800);
      lock();
    },
  });
}
function placePod(blocks) {
  for (const [q, r, y, id] of blocks) if (y > 0 && y < H && world.getBlock(q, r, y) !== id) world.setBlock(q, r, y, id);
  world.changed = true;
}
// les capsules des autres joueurs (on les voit seulement tomber)
const pods = [];
function podSeen(plan) {
  pods.push(playPod({ scene, atlas, plan, ear: () => listener, onRest: (b) => { if (!net.isClient) placePod(b); } }));
}

// ---------- L'épave du vaisseau (la première fois dans un monde) ----------
// Le HEXA-7 tel qu'il a fini (voir wreckPlan dans intro.js), posé en vrais blocs là où il s'est
// arrêté en glissant (voir crash.js : case (q, r), plancher en y, tourné de rot sixièmes de
// tour), plus les blocs qu'il a perdus en route. On se réveille dedans, à côté d'un coffre de
// secours.
let wreckPending = false;
function buildWreck({ q: cq, r: cr, y: fy, rot = 0, side = 1, debris = [] }) {
  const raw = wreckPlan(side);
  const turn = ([q, r, y, ...rest]) => [...rotHex(q, r, rot), y, ...rest];
  const plan = { blocks: raw.blocks.map(turn), air: raw.air.map(turn), inside: turn(raw.inside), chest: turn(raw.chest) };
  const c = { q: cq, r: cr };
  const top = (q, r) => { // (le sol : ni feuilles, ni tronc, ni eau)
    for (let y = H - 2; y > Y_MIN + 1; y--) { const id = world.getBlock(q, r, y); if (SUPPORT[id] && !BLOCKS[id].leaves && !BLOCKS[id].log) return y; }
    return 1;
  };
  const set = (q, r, y, id) => { if (y > Y_MIN && y < H && world.getBlock(q, r, y) !== id) world.setBlock(q, r, y, id); };
  const oy = Math.max(Y_MIN + 2, Math.min(H - 14, fy)); // (un monde plat : le sol est bien sous y = 0)
  // on dégage la place (terre, arbres) du bas de l'épave jusqu'au-dessus
  const low = new Map();
  for (const [q, r, y] of [...plan.blocks, ...plan.air]) { const k = q + ',' + r; low.set(k, Math.min(low.get(k) ?? 99, y)); }
  for (const [k, ly] of low) {
    const [q, r] = k.split(',').map(Number);
    const hi = Math.max(top(c.q + q, c.r + r), oy + 11) + 6;
    for (let y = oy + ly; y <= hi; y++) set(c.q + q, c.r + r, y, AIR);
  }
  for (const [q, r, y, id] of plan.blocks) set(c.q + q, c.r + r, oy + y, id);
  // les blocs tombés pendant la glissade
  for (const [q, r, y, id] of debris) if (world.getBlock(q, r, y) === AIR) set(q, r, y, id);
  // le coffre de secours
  if (plan.chest) {
    const [q, r, y] = plan.chest;
    set(c.q + q, c.r + r, oy + y, CHEST);
    const box = containers.at(c.q + q, c.r + r, oy + y);
    if (box) [[COOKED_PORK, 6], [IRON_INGOT, 3], [TORCH, 8], [COAL, 6]].forEach(([id, n], i) => { box.slots[i] = makeSlot(id, n); });
  }
  // on se réveille dedans, dans les quartiers, tourné vers la soute (et la brèche)
  const [q, r, y] = plan.inside;
  const p = hexToWorld(c.q + q, c.r + r);
  player.pos.set(p.x, oy + y, p.z);
  player.vel.set(0, 0, 0);
  const back = worldToHex(0, 8), [bq, br] = rotHex(back.q, back.r, rot), bw = hexToWorld(bq, br);
  player.yaw = Math.atan2(-bw.x, -bw.z); // (vers l'arrière du vaisseau : la porte de la soute, et la brèche)
  player.pitch = 0;
  player.fly = false;
  current.wreck = { q: c.q, r: c.r, y: oy, side, rot };
  world.changed = true;
  return true;
}

// Le réveil : les paupières s'ouvrent, se referment, s'ouvrent ; la vue floue redevient nette
function wakeUp(inWreck) {
  document.getElementById('wake')?.remove();
  const el = document.createElement('div');
  el.id = 'wake';
  el.innerHTML = '<div class="lid top"></div><div class="lid bottom"></div>';
  document.body.appendChild(el);
  canvas.classList.remove('waking');
  void canvas.offsetWidth; // (relance l'animation)
  canvas.classList.add('waking');
  setTimeout(() => { el.remove(); canvas.classList.remove('waking'); }, 6500);
  if (inWreck) setTimeout(() => addChat("Tu te réveilles dans l'épave du HEXA-7… Le coffre de secours a tenu le coup.", 'sys'), 3800);
}

// (quiet : on sort d'un menu, coffre, inventaire... : jamais le menu pause, on revient au jeu)
let lockQuiet = false;
let touch = null; // commandes tactiles (voir touch.js), créées avec les entrées
function lockFailed() {
  if (state !== 'paused' || screen || lockQuiet) return;
  show('pause');
}
// (escClose : le menu se ferme par Échap. Le navigateur garde cette touche pour lui : la souris
// reprise pendant l'appui lui serait aussitôt rendue, ce qui ouvrait le menu pause. On la reprend
// juste après, quand la touche est relâchée, comme dans Minecraft : le menu se ferme, on rejoue)
let escClose = false;
function lock(quiet = false) {
  lockQuiet = quiet;
  // (commandes tactiles : pas de souris à capturer, on reprend le jeu)
  // (de même à la manette : on joue sans capturer la souris)
  if (touch?.on || pad?.using) { escClose = false; state = 'playing'; hideScreens(); return; }
  if (escClose) {
    escClose = false;
    let done = false;
    const go = () => { if (done) return; done = true; removeEventListener('keyup', up, true); if (state === 'paused' && !screen) lock(true); };
    const up = (e) => { if (e.code === 'Escape') setTimeout(go, 0); };
    addEventListener('keyup', up, true);
    setTimeout(go, 400); // (touche relâchée hors de la fenêtre : on y va quand même)
    return;
  }
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(lockFailed);
  } catch {
    lockFailed();
  }
}

document.getElementById('btn-resume').addEventListener('click', () => lock());
canvas.addEventListener('click', () => { if (state === 'paused' && !screen) lock(); });
document.getElementById('btn-save-quit').addEventListener('click', () => {
  saveGame(false);
  enterTitle();
});

// ---------- Multijoueur ----------
let online = null; // partie rejointe : { host, address }
const net = new Net({
  world, player, carts, scene, tnt, structs, ropes, listener, items, animals, voice, cartons, trains, tracks, industry,
  industryReply: (m) => industryReply(m),
  setPhys: (sid, k, p) => setPhys(sid, k, p),
  renameTarget: (k, n) => { if (targetNames.has(k)) { targetNames.set(k, n); world.changed = true; shareTargets(); } },
  setTargets: (l) => { targetNames = new Map(l.filter((e) => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string').map(([k, n]) => [k, n.slice(0, TARGET_NAME_MAX)])); },
  // (invité : l'hôte a posé notre locomotive / wagon : l'objet quitte l'inventaire)
  trainPlaced: () => { useHeld(); playPlace('rail'); },
  pilotBusy: () => pilotBusy(),
  give: (id, n, w) => { if (survival.on && survival.give(id, n, w)) toast('Inventaire plein'); },
  // (invité : le contenu d'un carton ramassé chez l'hôte ; ce qui ne rentre pas repart dans un carton)
  cartonGive: (list) => { const left = grabCarton({ items: list }); if (left.length) spawnCarton(player.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), left, null, 2); },
  villagerVoice: (a, k) => villagerVoice(a, k),
  receiveGift: (a, name, id, n) => receiveGift(a, name, id, n),
  name: () => options.pseudo,
  creative: () => !survival.on, // (créatif : la bedrock se casse)
  clan: () => (account.loggedIn && account.clan ? account.clan.tag + ':' + (account.clan.color | 0) : ''),
  color: () => account.color,
  getWaypoints: () => waypoints,
  setWaypoints: (l) => { waypoints = cleanWaypoints(l); worldMap.dirty = true; },
  addWaypoint: (x, z, n, by) => addWaypoint(x, z, n, by),
  removeWaypoint: (id) => removeWaypoint(id),
  skin: () => options.skin,
  held: () => hotbar[slot],
  current: () => current,
  getTime: () => dayTime,
  getDays: () => dayCount,
  setDays: (d) => { dayCount = d; },
  setTime: (t) => {
    // petit écart : on rattrape en douceur ; grand écart : on saute
    let d = t - dayTime;
    if (d > 0.5) d -= 1; else if (d < -0.5) d += 1;
    dayTime = Math.abs(d) > 0.01 ? t : (dayTime + d * 0.5 + 1) % 1;
  },
  snapshot: () => { const d = Save.serialize(current, world, player, slot, dayTime, hotbar, []); d.world.spaces = flight.serialize(); d.world.orbital = orbital.serialize(); return d; },
  get flight() { return flight; },
  get rockets() { return rockets; },
  chat: (text, kind) => addChat(text, kind),
  weatherCommand: (args, pos) => weatherCommand(args, pos),
  getPressures: () => sky.clouds.climate.pressures,
  setPressures: (l) => sky.clouds.climate.setPressures(l),
  playersChanged: () => { renderPlayerList(); commands.resend(); },
  sbView: (v) => commands.applyView(v),
  sbClient: (c, m) => commands.fromClient(c, m),
  joined: (m) => joinWorld(m),
  podCrash: (plan) => podSeen(plan),
  containers,
  boxReceived: (k, c) => boxReceived(k, c),
  boxUpdated: (box) => { if (survival.box === box) survival.render(); },
  hurtSelf: (d, x, z, by) => hurtSelf(d, x, z, by),
  get weapons() { return weapons; },
  weaponMsg: (t) => toast(t),
  disconnected: (reason) => showDisconnected(reason),
});

const commands = new Commands({
  world, get player() { return player; }, survival, animals, net, containers, fx, Y_MIN,
  chat: (t, k) => addChat(t, k), name: () => options.pseudo,
  mode: () => (spectator ? 'spectator' : survival.on ? 'survival' : 'creative'),
  playBreak: (id) => playBreak(matterOf(id)),
  dropAt: (c, stacks) => spawnCarton(new THREE.Vector3(c.x, c.y + 0.5, c.z), stacks, null, 1),
  viewChanged: () => renderPlayerList(),
});
animals.onKill = (a, by) => commands.killed(by, a.type);

const pauseHostBtn = document.getElementById('btn-open-host');
const saveQuitBtn = document.getElementById('btn-save-quit');
function updatePauseMenu() {
  pauseHostBtn.disabled = !net.available || net.isClient;
  pauseHostBtn.textContent = net.isHost ? 'Serveur en ligne…' : 'Ouvrir en multijoueur…';
  saveQuitBtn.textContent = net.isClient ? 'Se déconnecter' : (net.isHost ? 'Sauvegarder, fermer le serveur et quitter' : 'Sauvegarder et quitter vers le titre');
}
pauseHostBtn.addEventListener('click', () => show('host'));

// --- Rejoindre un serveur
const mpName = document.getElementById('mp-name');
const mpAddr = document.getElementById('mp-addr');
const mpPass = document.getElementById('mp-pass');
const mpStatus = document.getElementById('mp-status');
const joinBtn = document.getElementById('btn-join');

function openMulti() {
  mpName.value = options.pseudo;
  mpAddr.value = '';
  mpPass.value = '';
  mpStatus.textContent = !net.available ? 'Ce navigateur ne permet pas le multijoueur.' : 'Entre le code de la partie que l\'hôte t\'a donné (HX-…).';
  joinBtn.disabled = !net.available;
  net.cancelCodeJoin();
  setTimeout(() => (mpAddr.value ? mpAddr : mpName).focus(), 0);
}

function checkPseudo(value) {
  const name = value.trim();
  if (!NAME_RE.test(name)) return null;
  options.pseudo = name;
  saveOptions();
  return name;
}

async function joinServer() {
  if (joinBtn.disabled) return;
  if (!checkPseudo(mpName.value)) { mpStatus.textContent = 'Pseudo : 2 à 16 lettres, chiffres, _ ou -'; return; }
  const addr = mpAddr.value.trim();
  if (!addr) { mpStatus.textContent = 'Entre le code de la partie (HX-…)'; return; }
  // code court de l'hôte (HX-4K7P2Q) : la seule façon de rejoindre (aucune adresse IP à échanger)
  if (!/^hx[-\s]?[0-9a-z]{6}$/i.test(addr.replace(/\s+/g, ''))) { mpStatus.textContent = 'Code invalide : il ressemble à HX-4K7P2Q'; return; }
  joinBtn.disabled = true;
  mpStatus.textContent = 'Recherche de la partie ' + addr.toUpperCase() + '…';
  online = { address: addr.toUpperCase() };
  const res = await net.joinShort(addr, mpPass.value);
  joinBtn.disabled = false;
  if (!res.ok) { online = null; mpStatus.textContent = res.error; return; }
  mpStatus.textContent = '';
}
joinBtn.addEventListener('click', joinServer);
for (const el of [mpName, mpAddr, mpPass]) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinServer(); });

// Le serveur a accepté : on entre dans son monde (sans rien sauvegarder chez nous)
const MP_HOTBAR_KEY = 'hexacraft.mphotbar';
function joinWorld(m) {
  show('loading');
  document.getElementById('loading-text').textContent = 'Chargement du monde de ' + m.host + '…';
  const data = m.world;
  current = null;
  online = { ...(online || {}), host: m.host, name: data.name };
  Save.applyToWorld(data, world, player);
  world.simulateWater = false;
  let saved = null;
  // (gardés par partie : hôte + monde ; avant, le même inventaire suivait le joueur dans tous les mondes)
  mpSuffix = ':' + m.host + ':' + (data.id || data.name) + ':' + data.seed;
  try { saved = JSON.parse(localStorage.getItem(MP_HOTBAR_KEY + mpSuffix)); } catch { /* ignoré */ }
  hotbar = Array.isArray(saved) && saved.length >= 9 ? fitHotbar(saved) : defaultHotbar();
  // partie en survie : l'inventaire et la vie de ce joueur sont gardés chez lui
  let inv = null;
  try { inv = JSON.parse(localStorage.getItem(MP_INV_KEY + mpSuffix)); } catch { /* ignoré */ }
  survival.load(data.mode === 'survival', inv?.slots, inv?.health, inv?.hunger);
  if (survival.on) player.fly = false;
  // (les tiers de ce joueur dans cette partie : gardés chez lui)
  let prog = null;
  try { prog = JSON.parse(localStorage.getItem(MP_PROG_KEY + mpSuffix)); } catch { /* ignoré */ }
  progress.start(prog);
  // partie hardcore : une seule vie ici aussi (mort une fois : spectateur dans cette partie)
  survival.setHardcore(!!data.hardcore);
  setSpectator(!!data.hardcore && !!inv?.over);
  modeStash = { hotbar: null, inv: null };
  if (player.riding) carts.dismount(player);
  player.riding = null;
  leavePilot(true);
  carts.clear();
  trains.clear();
  engineSound(0, 0, 0); // (plus de moteur qui gronde)
  tracks.clear();
  photos.clear();
  industry.clear();
  industry.scan(world.mods, CS, -Y_MIN);
  structs.worldParams = new Map((Array.isArray(data.world?.phys) ? data.world.phys : []).filter((e) => Array.isArray(e) && typeof e[0] === 'string' && Array.isArray(e[1]) && ((e[1].length === 3 && e[1].every(Number.isFinite)) || validGrav(e[1]))));
  targetNames = new Map((Array.isArray(data.world?.targets) ? data.world.targets : []).filter((e) => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string').map(([k, n]) => [k, n.slice(0, TARGET_NAME_MAX)]));
  tnt.clear();
  structs.clear();
  animals.clear();
  hexaliens.clear();
  animals.remote = true;
  player.standingOn = player.attached = player.aboard = null;
  for (const d of m.structs || []) structs.applyDef(d);
  ropes.load(m.ropes);
  renderHotbar();
  selectSlot(0, true);
  dayTime = Number.isFinite(m.time) ? m.time : 0.05;
  // (invité : sa carte de cette partie, gardée chez lui comme son inventaire)
  let ex = null;
  try { ex = localStorage.getItem(MP_MAP_KEY + mpSuffix); } catch { /* ignoré */ }
  explored = new Set(typeof ex === 'string' && ex ? ex.split(';').filter((k) => /^-?\d+,-?\d+$/.test(k)) : []);
  timeLock = null; // (en ligne chez un autre : c'est l'hôte qui donne l'heure)
  dayCount = Number.isInteger(m.days) ? m.days : 0;
  sky.setSeed(data.seed);
  sky.viewSeed = data.seed;
  flight.load(data.world?.spaces, data.type !== 'tutorial');
  orbital.clear();
  orbital.scan(world.mods, CS, -Y_MIN);
  orbital.load(data.world?.orbital);
  commands.reset(null);
  viewMode = 0;
  chatEl.innerHTML = '';
  addChat(`Connecté à la partie de ${m.host}. T pour parler, Tab pour voir les joueurs.`, 'sys');
  // la première fois dans cette partie : la cinématique, puis la capsule qui s'écrase dans l'eau
  if (options.intro !== false && data.player?.x === undefined) startIntro(true);
  state = 'loading';
  loadStart = performance.now();
}
// la barre d'objets en ligne est gardée chez le joueur
const MP_INV_KEY = 'hexacraft.mpinv', MP_MAP_KEY = 'hexacraft.mpmap';
let mpSuffix = ''; // (la partie en cours : hôte, monde)
// partie hardcore d'un autre : on y est mort, c'est fini pour nous (retenu comme l'inventaire)
function hardcoreOverOnline() {
  try { localStorage.setItem(MP_INV_KEY + mpSuffix, JSON.stringify({ over: true })); } catch { /* ignoré */ }
}
setInterval(() => {
  if (!net.isClient || spectator) return;
  try {
    if (survival.on) localStorage.setItem(MP_INV_KEY + mpSuffix, JSON.stringify({ slots: survival.saveInv(), health: survival.health, hunger: survival.hunger }));
    else localStorage.setItem(MP_HOTBAR_KEY + mpSuffix, JSON.stringify(hotbar));
    localStorage.setItem(MP_MAP_KEY + mpSuffix, [...explored].join(';'));
    if (progress.on) localStorage.setItem(MP_PROG_KEY + mpSuffix, JSON.stringify(progress.save()));
  } catch { /* ignoré */ }
}, 5000);

const discReason = document.getElementById('disc-reason');
function showDisconnected(reason) {
  enterTitle();
  discReason.textContent = reason;
  show('disconnected');
}
document.getElementById('btn-disc-ok').addEventListener('click', () => show('title'));

// --- Héberger
const hostName = document.getElementById('host-name');
const hostPass = document.getElementById('host-pass');
const hostStatus = document.getElementById('host-status');
const hostSetup = document.getElementById('host-setup');
const hostInfo = document.getElementById('host-info');
const hostStartBtn = document.getElementById('btn-host-start');
const hostStopBtn = document.getElementById('btn-host-stop');
let hostResult = null;


function openHost() {
  if (!net.isHost) {
    hostName.value = options.pseudo;
    hostPass.value = '';
    hostStatus.textContent = !net.available ? 'Ce navigateur ne permet pas le multijoueur.' : 'Tes amis rejoignent avec un code (aucune adresse ni port à régler). Garde le jeu ouvert pendant la partie.';
    hostStartBtn.disabled = !net.available;
  }
  renderHostInfo();
}

function renderHostInfo() {
  const on = net.isHost;
  hostSetup.hidden = on;
  hostInfo.hidden = !on;
  hostStartBtn.hidden = on;
  hostStopBtn.hidden = !on;
  if (!on || !hostResult) return;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const code = hostResult.shortCode
    ? `<h4>Par internet : donne ce code à tes amis</h4><p class="short-code"><code id="host-short">${esc(hostResult.shortCode)}</code> <button id="btn-copy-short">Copier</button></p>` +
      `<p><small>Ils le tapent dans Multijoueur. Le code marche tant que le monde reste ouvert.</small></p>`
    : `<p class="warn">Code de connexion indisponible${hostResult.shortError ? ' : ' + esc(hostResult.shortError) : ''}.</p>`;
  hostInfo.innerHTML = `<p><span class="ok">Monde ouvert ✓</span>${hostResult.password ? ' — avec mot de passe' : ''} — ${net.list.length} joueur(s) dans la partie</p>` + code +
    '<p><small>Garde le jeu ouvert : si tu le fermes ou le réduis longtemps, tes amis peuvent être déconnectés.</small></p>';
  document.getElementById('btn-copy-short')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    navigator.clipboard.writeText(hostResult.shortCode).then(() => { btn.textContent = 'Copié ✓'; setTimeout(() => { btn.textContent = 'Copier'; }, 1500); });
  });
}

hostStartBtn.addEventListener('click', async () => {
  if (hostStartBtn.disabled) return;
  if (!checkPseudo(hostName.value)) { hostStatus.textContent = 'Pseudo : 2 à 16 lettres, chiffres, _ ou -'; return; }
  hostStartBtn.disabled = true;
  hostStatus.textContent = 'Création du code de la partie…';
  const res = await net.host({ password: hostPass.value });
  hostStartBtn.disabled = false;
  if (!res.ok) { hostStatus.textContent = res.error; return; }
  hostResult = { ...res, password: !!hostPass.value };
  setTimeout(sendPresence, 0);
  addChat(`Monde ouvert en multijoueur : code ${res.shortCode || '(indisponible)'}`, 'sys');
  renderHostInfo();
});
hostStopBtn.addEventListener('click', () => {
  net.stopHost();
  setTimeout(sendPresence, 0);
  saveGame(false);
  addChat('Partie fermée.', 'sys');
  renderHostInfo();
});
document.getElementById('btn-host-back').addEventListener('click', () => show('pause'));

// --- Chat
const chatEl = document.getElementById('chat');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
function addChat(text, kind = 'chat') {
  const el = document.createElement('div');
  el.className = 'msg ' + kind;
  el.textContent = text;
  chatEl.appendChild(el);
  while (chatEl.children.length > 60) chatEl.firstChild.remove();
  setTimeout(() => el.classList.add('old'), 10000);
}
function openChat(prefix = '') {
  state = 'chat';
  keys.clear();
  mouse.left = mouse.right = false;
  document.body.classList.add('chatting');
  chatInput.value = prefix;
  chatHistAt = -1;
  document.exitPointerLock();
  if (touch?.on) chatInput.focus(); // (iPad : le clavier ne s'ouvre que pendant le toucher)
  setTimeout(() => chatInput.focus(), 0);
}
function closeChat(relock = true) {
  if (state !== 'chat') return;
  document.body.classList.remove('chatting');
  chatInput.blur();
  chatHint.hidden = true;
  chatCycle = null;
  state = 'paused';
  if (relock) lock();
}
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text) remember(text);
  // les scènes : /intro, /intromulti, /capsule (développement : l'écrasement de la capsule
  // seul, sans la cinématique). Le chat se ferme sans reprendre la souris (la scène en a besoin
  // pour le clic de la fin).
  if (/^\/(intro|intromulti|capsule)$/i.test(text)) {
    closeChat(false);
    const cmd = text.slice(1).toLowerCase();
    if (introOn || crashScene?.active) addChat('Une scène est déjà en cours', 'err');
    else if (cmd === 'capsule') { hideScreens(); startPod(); }
    else startIntro(cmd === 'intromulti');
    return;
  }
  if (text) {
    if (/^\/(gamemode|gm)(\s|$)/i.test(text)) gamemodeCommand(text.split(/\s+/)[1]);
    else if (!net.active && /^\/(weather|meteo|météo)(\s|$)/i.test(text)) for (const l of weatherCommand(text.split(/\s+/).slice(1), player.pos)) addChat(l.text, l.kind);
    else if (/^\/(tp|teleport)(\s|$)/i.test(text)) tpCommand(text.split(/\s+/).slice(1));
    else if (/^\/astre(\s|$)/i.test(text)) astreCommand(text.slice(6).trim());
    else if (/^\/afk$/i.test(text)) afkCommand();
    else if (/^\/(equipe|équipe|team)(\s|$)/i.test(text)) teamCommand(text.split(/\s+/)[1]);
    else if (/^\/secret(\s|$)/i.test(text)) secretCommand(text.split(/\s+/)[1]);
    else if (/^\/(worldrule|gamerule)(\s|$)/i.test(text)) {
      if (net.isClient) addChat('Seul l\'hôte peut voir ou changer les règles du monde', 'err');
      else worldruleCommand(text.split(/\s+/).slice(1));
    }
    else if (/^\/vaisseau$/i.test(text)) shipCommand();
    else if (/^\/traveler$/i.test(text)) {
      // téléporte devant le sas de l'épave du Traveler-98 (voir crashSite dans gen.js)
      const s = world.gen.crashSite?.();
      if (!s) addChat("Pas d'épave du Traveler-98 dans ce monde (ou l'endroit était déjà exploré)", 'sys');
      else {
        const u = 22, v = 11; // (le sas est en u = 22, sa porte vers v = 8)
        tpCommand([String(s.x + u * s.c - v * s.s), String(s.z + u * s.s + v * s.c)]);
        player.yaw = Math.atan2(-s.s, s.c); // (tourné vers le vaisseau)
        player.pitch = 0;
        addChat('Épave du Traveler-98 : le sas est droit devant', 'sys');
      }
    }
    else if (/^\/(saison|season)(\s|$)/i.test(text)) {
      if (net.isClient && text.trim().split(/\s+/).length > 1) addChat('Seul l\'hôte peut changer de saison', 'err');
      else seasonCommand(text.split(/\s+/).slice(1));
    }
    else if (/^\/(time|temps|heure)(\s|$)/i.test(text)) {
      if (net.isClient) addChat('Seul l\'hôte peut changer l\'heure', 'err');
      else timeCommand(text.split(/\s+/).slice(1));
    }
    else if (/^\/(voie|rail|rails)(\s|$)/i.test(text)) {
      if (net.isClient) addChat('Seul l\'hôte peut utiliser /voie', 'err');
      else voieCommand(text.split(/\s+/).slice(1));
    }
    else if (COMMAND_RE.test(text)) {
      if (net.isClient) addChat('Seul l\'hôte peut utiliser cette commande', 'err');
      else {
        if (/^\/(setblock|fill)/i.test(text) && current && !current.noRank) { current.noRank = true; addChat('Commande de construction : ce monde ne compte plus pour les classements', 'sys'); }
        commands.run(text);
      }
    }
    else if (/^\/place(\s|$)/i.test(text)) {
      if (net.isClient) addChat('Seul l\'hôte peut utiliser /place', 'err');
      else placeCommand(text.slice(6).trim().split(/\s+/).filter(Boolean));
    } else if (net.active) net.sendChat(text);
    else if (/^\/(help|aide)$/i.test(text)) for (const l of helpLines(false, true)) addChat(l, 'sys');
    else if (text.startsWith('/')) addChat('Cette commande sert en multijoueur (menu du jeu > Ouvrir en multijoueur)', 'sys');
    else addChat(`<${options.pseudo}> ${text}`, 'chat');
  }
  closeChat();
});
chatInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Escape') { e.preventDefault(); closeChat(); }
  if (e.key === 'Tab' && chatCompletes(chatInput.value)) { e.preventDefault(); chatComplete(); }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); chatRecall(e.key === 'ArrowUp' ? 1 : -1); }
});
// Flèche du haut / du bas : les messages et commandes déjà envoyés (les 50 derniers, gardés entre
// deux parties). chatHistAt : -1 = le texte en cours d'écriture (chatDraft)
const CHAT_HIST_KEY = 'hexacraft.chatHistory';
let chatHist = [];
try { const h = JSON.parse(localStorage.getItem(CHAT_HIST_KEY) || '[]'); if (Array.isArray(h)) chatHist = h.filter((x) => typeof x === 'string').slice(-50); } catch { /* (rien de gardé) */ }
let chatHistAt = -1, chatDraft = '';
function remember(text) {
  if (chatHist[chatHist.length - 1] !== text) chatHist.push(text);
  if (chatHist.length > 50) chatHist.splice(0, chatHist.length - 50);
  try { localStorage.setItem(CHAT_HIST_KEY, JSON.stringify(chatHist)); } catch { /* (tant pis) */ }
}
function chatRecall(dir) {
  if (!chatHist.length) return;
  if (chatHistAt === -1) { if (dir < 0) return; chatDraft = chatInput.value; }
  chatHistAt = Math.max(-1, Math.min(chatHist.length - 1, chatHistAt + dir));
  chatInput.value = chatHistAt === -1 ? chatDraft : chatHist[chatHist.length - 1 - chatHistAt];
  const end = chatInput.value.length;
  chatInput.setSelectionRange(end, end);
  chatCycle = null;
  showChatHint();
}
// Tab complète /setblock, /fill, /say, /scoreboard (les noms de blocs, les sous-commandes...)
// (toutes les commandes : leurs noms, puis leurs mots — joueurs, structures, mots-clés ; /setblock,
// /fill, /say, /scoreboard : voir commands.js)
const chatHint = document.getElementById('chat-hint');
const CHAT_COMMANDS = ['help', 'worldrule', 'gamemode', 'tp', 'traveler', 'time', 'saison', 'weather', 'voie', 'place', 'setblock', 'fill', 'say', 'scoreboard', 'vaisseau', 'astre', 'afk', 'equipe', 'intro', 'intromulti', 'capsule', 'secret'];
const ONLINE_COMMANDS = ['list', 'pvp', 'kick'];
function chatSuggest(t) {
  if (COMMAND_RE.test(t)) return commands.completions(t);
  const parts = t.replace(/^\//, '').split(' '), n = parts.length, cmd = parts[0].toLowerCase(), last = parts[n - 1].toLowerCase();
  const names = () => [...net.remotes.values()].map((p) => p.name);
  let c = [];
  if (n === 1) c = [...CHAT_COMMANDS, ...(net.active ? ONLINE_COMMANDS : [])];
  else if (cmd === 'gamemode' || cmd === 'gm') c = n === 2 ? ['survie', 'creatif'] : [];
  else if (cmd === 'tp' || cmd === 'teleport') c = n === 2 ? ['spawn', '~', ...names()] : n <= 4 ? ['~'] : [];
  else if (cmd === 'astre') c = n === 2 ? ['hexa', ...LAND_IDS()] : [];
  else if (cmd === 'equipe' || cmd === 'équipe' || cmd === 'team') c = n === 2 ? [...TEAMS.map((t) => t.id), 'aucune'] : [];
  else if (cmd === 'time' || cmd === 'temps' || cmd === 'heure') c = n === 2 ? ['jour', 'nuit', 'matin', 'soir', 'normal'] : n === 3 ? ['éternel'] : [];
  else if (cmd === 'saison' || cmd === 'season') c = n === 2 ? ['printemps', 'été', 'automne', 'hiver'] : [];
  else if (cmd === 'weather' || cmd === 'meteo' || cmd === 'météo') c = n === 2 ? ['tornade', 'asteroides', 'reset', '-5', '-4', '-3', '-2', '-1', '1', '2', '3', '4', '5'] : [];
  else if (cmd === 'voie' || cmd === 'rail' || cmd === 'rails') c = n <= 5 ? ['~'] : n === 6 ? ['double'] : [];
  else if (cmd === 'place') c = n === 2 ? [...Object.keys(BUILDS), ...structStore.list().map((st) => st.name)] : n <= 5 ? ['~'] : [];
  else if (cmd === 'secret' || cmd === 'pvp') c = n === 2 ? ['on', 'off'] : [];
  else if (cmd === 'worldrule' || cmd === 'gamerule') c = n === 2 ? Object.keys(WORLD_RULES) : n === 3 ? ['true', 'false'] : [];
  else if (cmd === 'kick') c = n === 2 ? names() : [];
  return c.filter((v) => v.toLowerCase().startsWith(last)).slice(0, 40);
}
const chatCompletes = (t) => t.startsWith('/');
let chatCycle = null;
function showChatHint() {
  const t = chatInput.value, list = chatCycle ? chatCycle.list : chatCompletes(t) && state === 'chat' ? chatSuggest(t) : [];
  chatHint.hidden = !list.length;
  if (!list.length) return;
  chatHint.innerHTML = '';
  const at = chatCycle ? chatCycle.i : 0, from = Math.max(0, Math.min(at - 3, list.length - 8));
  list.slice(from, from + 8).forEach((w, i) => {
    if (i) chatHint.append('  ');
    const el = document.createElement(from + i === at ? 'b' : 'span');
    el.textContent = w;
    chatHint.append(el);
  });
  if (list.length > 8) chatHint.append(`  (${at + 1}/${list.length})`);
}
function chatComplete() {
  if (!chatCycle) {
    const list = chatSuggest(chatInput.value);
    if (!list.length) return;
    const cut = chatInput.value.lastIndexOf(' ') + 1;
    chatCycle = { list, i: -1, head: chatInput.value.slice(0, cut || 1) };
  }
  chatCycle.i = (chatCycle.i + 1) % chatCycle.list.length;
  chatInput.value = chatCycle.head + chatCycle.list[chatCycle.i];
  showChatHint();
}
chatInput.addEventListener('input', () => { chatCycle = null; showChatHint(); });

// --- Liste des joueurs (Tab)
const playerListEl = document.getElementById('playerlist');
function renderPlayerList() {
  if (screen === 'host') renderHostInfo();
  if (playerListEl.hidden) return;
  playerListEl.innerHTML = '';
  const h = document.createElement('h4');
  h.textContent = online ? `Partie de ${online.host}` : 'Joueurs connectés';
  playerListEl.appendChild(h);
  for (const [pid, name, ping] of net.list) {
    const row = document.createElement('div');
    const n = document.createElement('span');
    n.textContent = name + (pid === 0 ? ' (hôte)' : '');
    const p = document.createElement('small');
    p.textContent = [commands.listScore(name), pid === 0 ? '' : ping + ' ms'].filter(Boolean).join(' · ');
    row.append(n, p);
    playerListEl.appendChild(row);
  }
}

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    state = 'playing';
    hideScreens();
  } else {
    keys.clear();
    mouse.left = mouse.right = false;
    if (state === 'playing') {
      state = 'paused';
      saveGame(false);
      show('pause');
    }
  }
});
document.addEventListener('pointerlockerror', lockFailed);

addEventListener('beforeunload', () => saveGame(false));
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveGame(false); touchPause(); } });
// Pause sans souris capturée (commandes tactiles) : comme quand on la relâche
function touchPause() {
  if ((!touch?.on && !pad?.using) || state !== 'playing') return;
  keys.clear();
  mouse.left = mouse.right = false;
  stopMining();
  state = 'paused';
  saveGame(false);
  show('pause');
}

// ---------- Entrées ----------
const keys = new Set();
const mouse = { left: false, right: false, cooldown: 0 };
let viewMode = 0; // 0 = 1re personne, 1 = 3e personne dos, 2 = 3e personne face
let showDebug = false;
// F1 : plus aucune interface (barre, cœurs, viseur, main, contour du bloc visé, messages...),
// pour les captures d'écran et les vidéos ; le chat réapparaît quand on l'ouvre
let hideUi = false;
function toggleUi() {
  hideUi = !hideUi;
  document.body.classList.toggle('no-ui', hideUi);
}
let lastSpace = 0, lastForward = 0;
const debugEl = document.getElementById('debug');

// ---------- Commandes tactiles (voir touch.js) ----------
// Le jeu y reçoit ses entrées habituelles : touches maintenues, appuis, clics, regard
const fakeKey = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
touch = createTouch({
  hold: (action, on) => { const c = Controls.keyOf(action); if (on) keys.add(c); else keys.delete(c); },
  key: (action, down) => fakeKey(down ? 'keydown' : 'keyup', Controls.keyOf(action)),
  escape: () => { fakeKey('keydown', 'Escape'); fakeKey('keyup', 'Escape'); },
  mouse: (b, down) => {
    const button = options.leftHanded && b !== 1 ? 2 - b : b; // (gaucher : mouseButton les réinverse)
    document.dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', { button, bubbles: true, cancelable: true }));
  },
  look: (dx, dy) => {
    if (state !== 'playing') return;
    const k = 0.0048 * (options.sens / 100);
    player.yaw -= dx * k;
    player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch - dy * k));
  },
  aimsAtCreature: () => !!(targetAnimal || targetPlayer) || player.riding?.kind === 'armored', // (tourelle : toucher tire)
  selectSlot: (i) => selectSlot(i),
  pause: () => touchPause(),
});
touch.hookHotbar(slotEls);

// ---------- Manette (voir gamepad.js) ----------
// Mêmes entrées que les commandes tactiles ; dans les menus, un curseur
const pad = createGamepad({
  playing: () => state === 'playing' && !document.body.classList.contains('cutscene'),
  hold: (action, on) => { const c = Controls.keyOf(action); if (on) keys.add(c); else keys.delete(c); },
  key: (action, down) => fakeKey(down ? 'keydown' : 'keyup', Controls.keyOf(action)),
  mouse: (b, down) => {
    const button = options.leftHanded && b !== 1 ? 2 - b : b; // (gaucher : mouseButton les réinverse)
    document.dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', { button, bubbles: true, cancelable: true }));
  },
  look: (dx, dy) => {
    if (state !== 'playing') return;
    player.yaw -= dx;
    player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch - dy));
  },
  selectSlot: (d) => { if (state === 'playing' || state === 'inventory' || state === 'craft') selectSlot((slot + d + 10) % 10); },
  pause: () => touchPause(),
  back: () => { fakeKey('keydown', 'Escape'); fakeKey('keyup', 'Escape'); },
  resume: () => { if (state === 'paused' && screen === 'pause') lock(); },
  sens: () => options.sens,
  toast: (t) => toast(t),
});
// la souris reprend la main dès qu'elle bouge vraiment
// (en jeu sans souris capturée : le menu pause, d'où un clic la reprend)
document.addEventListener('mousemove', (e) => {
  if (!pad.using || !e.isTrusted || !(e.movementX || e.movementY)) return;
  pad.mouseUsed();
  if (state === 'playing' && !touch.on && document.pointerLockElement !== canvas) { keys.clear(); mouse.left = mouse.right = false; stopMining(); state = 'paused'; show('pause'); }
});
function applyTouch() {
  touch.setEnabled(options.touch === 'on' || (options.touch !== 'off' && touchDevice()));
}
applyTouch();
// (iPad : pas de zoom à deux doigts ni au double toucher pendant la partie)
document.addEventListener('gesturestart', (e) => e.preventDefault());

addEventListener('keydown', (e) => {
  if (e.code === 'F5' || e.code === 'F1' || Controls.is(e, 'debug')) e.preventDefault();
  if (e.code === 'F1' && !e.repeat && state !== 'menu' && state !== 'loading') { toggleUi(); return; }
  if (state === 'phys') {
    if (e.code === 'Escape') { e.preventDefault(); escClose = true; closePhys(false); escClose = false; }
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); closePhys(true); }
    return;
  }
  if (state === 'craft') {
    // (on tape dans la recherche du livre de recettes : seul Échap ferme)
    if (document.activeElement?.id === 'recipe-search' && e.code !== 'Escape') return;
    if (Controls.is(e, 'inventory') || e.code === 'Escape') { e.preventDefault(); escClose = e.code === 'Escape'; closeCraft(); escClose = false; return; }
    const d = /^Digit([0-9])$/.exec(e.code);
    if (d) survival.numberKey((+d[1] + 9) % 10);
    return;
  }
  if (state === 'dead') return;
  if (state === 'inventory') {
    if (Controls.is(e, 'inventory') && document.activeElement !== invSearch) { e.preventDefault(); closeInventory(); return; }
    if (e.code === 'Escape') { escClose = true; closeInventory(); escClose = false; return; }
    const d = /^Digit([0-9])$/.exec(e.code);
    if (d && hoverId && document.activeElement !== invSearch) {
      hotbar[(+d[1] + 9) % 10] = hoverId;
      renderHotbar();
    }
    return;
  }
  if (state !== 'playing') return;
  if (grab && !e.repeat && Controls.is(e, 'grabAxis')) { nextGrabAxis(); return; }
  if (grab && !e.repeat && Controls.is(e, 'grabStraight')) { straightenGrab(); return; }
  if (Controls.is(e, 'inventory')) {
    e.preventDefault();
    if (e.repeat) return;
    if (targetCarton) { pickCarton(targetCarton); invKeyDown = -1; return; } // (un carton visé : on le ramasse)
    invKeyDown = performance.now(); // (court : l'inventaire au relâchement ; long : collecte auto)
    return;
  }
  if (Controls.is(e, 'drop')) {
    e.preventDefault();
    keys.add(e.code); // (maintenue : voir la boucle)
    if (e.repeat) return;
    dropHeld(e.ctrlKey);
    dropNext = performance.now() + DROP_DELAY; // (maintenue : on continue de jeter, voir la boucle)
    return;
  }
  if ((Controls.is(e, 'chat') || e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat) { e.preventDefault(); openChat(); return; }
  if (e.key === '/' && !e.repeat) { e.preventDefault(); openChat('/'); return; }
  if (Controls.is(e, 'players')) {
    e.preventDefault();
    if (net.active && playerListEl.hidden) { playerListEl.hidden = false; renderPlayerList(); }
    return;
  }
  if (Controls.is(e, 'down') && player.pilot && !e.repeat) { leavePilot(); return; }
  if (player.pilot?.car && (e.code === 'KeyR' || e.code === 'KeyF')) { carPower(e.code === 'KeyR' ? 1 : -1); return; }
  if (player.pilot && !player.pilot.passenger && !player.pilot.car && e.code === 'KeyR' && !e.repeat) { pilotInput.toggleLevel = true; return; }
  if (player.pilot && !player.pilot.passenger && !player.pilot.car && e.code === 'KeyG' && !e.repeat) {
    pilotInput.toggleFA = true;
    const on = player.pilot.s.fa === false; // (l'état après la bascule)
    toast(on ? "Assistance de vol active : la rotation s'arrête quand on lâche, la dérive est annulée dans l'espace" : 'Assistance de vol coupée : physique pure, la fusée garde sa rotation et sa lancée');
    return;
  }
  if (player.pilot && !player.pilot.passenger && e.code === 'KeyJ' && !e.repeat && flight.inVoid) { flight.toggleJump(player.pilot.s); return; }
  if (flight.inVoid && e.code === 'KeyN' && !e.repeat) { flight.nextTarget(); return; }
  if (Controls.is(e, 'down') && player.riding && !e.repeat) {
    if (net.isClient) net.cartAction('dismount'); else carts.dismount(player);
    return;
  }
  if (Controls.is(e, 'voice')) voice.ptt = true; // (chat vocal : appuyer pour parler)
  if (e.repeat) { keys.add(e.code); return; }
  keys.add(e.code);

  if (Controls.is(e, 'jump')) {
    const now = performance.now();
    // (pas de vol en survie)
    if (now - lastSpace < 300 && !survival.on) { player.fly = !player.fly; player.vel.y = 0; toast(player.fly ? 'Vol activé' : 'Vol désactivé'); }
    lastSpace = now;
  }
  if (Controls.is(e, 'forward') || e.code === 'ArrowUp') {
    const now = performance.now();
    if (now - lastForward < 250) player.sprint = true;
    lastForward = now;
  }
  if (e.code === 'F5' || Controls.is(e, 'view')) viewMode = (viewMode + 1) % 3;
  if (player.riding?.kind === 'loco' && Controls.is(e, 'autopilot')) toggleAutopilot(player.riding);
  if ((player.riding?.kind === 'loco' || player.riding?.kind === 'tail') && Controls.is(e, 'whistle')) trainHorn(player.riding);
  if (Controls.is(e, 'debug')) { showDebug = !showDebug; debugEl.hidden = !showDebug; }
  if (Controls.is(e, 'objectives')) progress.toggle();
  const digit = /^Digit([0-9])$/.exec(e.code);
  if (digit) selectSlot((+digit[1] + 9) % 10);
});
addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (Controls.is(e, 'voice')) voice.ptt = false;
  if (Controls.is(e, 'inventory')) {
    const short = invKeyDown > 0 && performance.now() - invKeyDown < INV_HOLD;
    invKeyDown = 0;
    if (short && state === 'playing') openInventory();
  }
  if (Controls.is(e, 'players')) playerListEl.hidden = true;
});

document.addEventListener('mousemove', (e) => {
  // (sans la souris capturée, elle ne fait pas tourner la vue : jeu à la manette ou tactile)
  if (state !== 'playing' || document.pointerLockElement !== canvas) return;
  const k = 0.0022 * (options.sens / 100);
  player.yaw -= e.movementX * k;
  player.pitch -= e.movementY * k;
  player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch));
});

// Souris pour gaucher (Options > Touches et souris) : clic gauche et clic droit échangés en jeu
const mouseButton = (e) => (options.leftHanded && (e.button === 0 || e.button === 2) ? 2 - e.button : e.button);
document.addEventListener('mousedown', (ev) => {
  if (state !== 'playing' || spectator) return;
  // (aux commandes, les mains sont sur le manche : un clic ne casse ni ne pose rien, on vise souvent
  // son propre poste ; le clic gauche tire avec les armes de l'engin, voir weapons.js)
  if (player.pilot) { if (mouseButton(ev) === 0 && !player.pilot.passenger) { mouse.seat = true; seatFire(true); } return; }
  // une arme à la main : clic gauche, on tire ; clic droit, le viseur
  if (heldGun() && (mouseButton(ev) === 0 || mouseButton(ev) === 2)) {
    ev.preventDefault();
    if (mouseButton(ev) === 0) { mouse.gun = true; mouse.gunPress = true; } else gunAim = true;
    return;
  }
  const e = { button: mouseButton(ev), shiftKey: ev.shiftKey, preventDefault: () => ev.preventDefault() };
  if (e.button === 0 || e.button === 2) hand.punch();
  // un Hexalien visé (plus près que le bloc visé) : il est étourdi, rien d'autre
  if (e.button === 0) {
    const hx = hexaliens.rayHit(eye, lookDir, 4);
    if (hx && !(target && target.t < hexaliens.hitT)) { hexaliens.hit(hx); mouse.cooldown = 0.4; return; }
  }
  if (e.button === 0 && grab) { turnGrab(e.shiftKey); mouse.cooldown = 0.25; return; }
  // dans la locomotive : clic gauche, le klaxon
  if (e.button === 0 && player.riding?.kind === 'armored') { fireTurret(player.riding); return; }
  if (e.button === 0 && (player.riding?.kind === 'loco' || player.riding?.kind === 'tail')) { trainHorn(player.riding); return; }
  // clic molette dans une cabine : le menu de la locomotive (composants, itinéraire)
  if (e.button === 1 && (player.riding?.kind === 'loco' || player.riding?.kind === 'tail')) { e.preventDefault(); openLoco(player.riding); return; }
  // à pied, clic molette sur une voiture de train : la dételer de celle de devant, ou l'atteler
  if (e.button === 1 && targetCart?.isTrain && !player.riding) {
    e.preventDefault();
    if (net.isClient) net.csend({ t: 'tr', a: 'couple', id: targetCart.id });
    else { const msg = trains.couple(targetCart); if (msg) toast(msg); }
    playClack(0, 2);
    return;
  }
  // survie : on casse en maintenant le clic (voir mine()), un chariot se reprend d'un coup
  if (e.button === 0 && targetAnimal) { mouse.left = true; attackAnimal(); mouse.cooldown = 0.25; return; }
  if (e.button === 0 && targetPlayer) {
    mouse.left = true;
    mouse.cooldown = 0.25;
    if (net.pvp) {
      net.attackPlayer(targetPlayer.pid, attackDamage(hotbar[slot]));
      targetPlayer.hurtT = 0.35;
      if (ITEMS[hotbar[slot]]?.tool) wearHeld(ITEMS[hotbar[slot]].tool === 'sword' ? 1 : 2);
    }
    return;
  }
  if (e.button === 0 && schemLeft()) { mouse.cooldown = 0.25; return; }
  if (e.button === 0) { mouse.left = true; if (!survival.on || targetCart) breakBlock(); }
  if (e.button === 2) { mouse.right = true; placeBlock(); }
  if (e.button === 1) { e.preventDefault(); pickBlock(); }
  mouse.cooldown = 0.25;
});
document.addEventListener('mouseup', (ev) => {
  const e = { button: mouseButton(ev) };
  if (e.button === 0) { mouse.left = false; stopMining(); }
  if (e.button === 2) { mouse.right = false; gunAim = false; }
  if (e.button === 0) { mouse.gun = false; mouse.seat = false; }
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => {
  if (state !== 'playing') return;
  if (grab) { grab.dist = Math.max(GRAB_MIN, Math.min(GRAB_MAX, grab.dist - Math.sign(e.deltaY) * Math.max(0.6, grab.dist * 0.08))); return; } // (loin : par plus grands pas)
  if (player.pilot?.car) { if (e.deltaY) carPower(-Math.sign(e.deltaY)); return; } // (au volant : la puissance des roues)
  selectSlot(slot + Math.sign(e.deltaY));
}, { passive: true });

// ---------- Actions sur les blocs ----------
const BEDROCK = 4;
let target = null;
const eye = new THREE.Vector3();
const lookDir = new THREE.Vector3();

function updateLook() {
  if (shipFrame?.on) { shipFrame.look(player, eye, lookDir); return; }
  eye.set(player.pos.x, player.pos.y + EYE - SNEAK_DROP * player.crouch, player.pos.z);
  lookDir.set(
    -Math.sin(player.yaw) * Math.cos(player.pitch),
    Math.sin(player.pitch),
    -Math.cos(player.yaw) * Math.cos(player.pitch),
  );
}

let railAim = null; // (le point visé sur une ligne spatiale, où aucun bloc n'est inscrit : voir placeBlock)
let targetCart = null;
let targetCarton = null; // carton visé (voir cartons.js)
let targetStruct = null; // { struct, hit, prev, t } : bloc visé sur un objet collé
let targetAnimal = null; // animal visé (plus proche que le bloc visé)
let targetPlayer = null; // joueur visé (en ligne)

// Joueur distant touché par le rayon (corps : trois sphères le long de sa hauteur)
function raycastPlayers(o, d, reach) {
  let best = null;
  for (const rp of net.remotes.values()) {
    if (!rp.placed || rp.cart) continue;
    for (const up of [0.45, 0.95, 1.5]) {
      const lx = rp.pos.x - o.x, ly = rp.pos.y + up - o.y, lz = rp.pos.z - o.z;
      const tc = lx * d.x + ly * d.y + lz * d.z;
      if (tc < 0) continue;
      const d2 = lx * lx + ly * ly + lz * lz - tc * tc;
      if (d2 > 0.42 * 0.42) continue;
      const t = tc - Math.sqrt(0.42 * 0.42 - d2);
      if (t <= reach && (!best || t < best.t)) best = { rp, t };
    }
  }
  return best;
}

// PvP : un autre joueur nous frappe (d points, depuis (x, z)) — seulement en survie
function hurtSelf(d, x, z, by) {
  if (!survival.on || survival.dead || state === 'dead') return;
  let dx = player.pos.x - x, dz = player.pos.z - z;
  const l = Math.hypot(dx, dz) || 1;
  player.vel.x += (dx / l) * 7;
  player.vel.z += (dz / l) * 7;
  player.vel.y = Math.max(player.vel.y, 5);
  deathBy = by || null;
  survival.damage(d);
  deathBy = null;
  if (survival.dead && by) net.sendChat(`(tué par ${by})`);
}

// Compteur de watts : ce que produit / consomme / garde le bloc industriel visé (invité : l'hôte
// le calcule, voir industryReply)
const wattsEl = document.getElementById('watts');
let wattsT = 0;
// Ce qu'on lit en visant un bloc d'un objet collé : batteries et énergie du vaisseau, panneaux,
// générateurs, réservoirs, tuyères, réacteurs, hélices ; une machine n'y tourne pas (pas de réseau)
const AROUND_ONE = [[0, 0, 1], [0, 0, -1], ...NEIGHBORS.map(([q, r]) => [q, r, 0])];
// Portes, blocs mécaniques, soudure (voir doors.js) : ce qu'on lit en les visant
const MECH_HELP = {
  hinge: 'avec du courant, ce qui est posé dessus pivote d\'un quart de tour (une porte : colle-la, pose-la dessus)',
  rotor: 'ce qui est posé dessus tourne sans fin, la vitesse suit le cran du courant',
  servo: 'ce qui est posé dessus tourne à un angle : le cran du courant, de 0 à 180°',
  slide: 'ce qui est posé dessus monte d\'autant de blocs que le cran du courant',
};
function sealText(id, welded, lvl = 15) {
  const B = BLOCKS[id];
  if (!B) return null;
  const w = welded ? ' · joint soudé' : '';
  if (B.door === 'seal' || B.door === 'airlock') return B.name.replace(' (ouverte)', '') + ' : ' + (B.doorOpen ? 'ouverte' : "fermée, l'air ne passe pas") + ' · clic droit : ' + (B.doorOpen ? 'fermer' : 'ouvrir') + (B.door === 'airlock' ? ' (deux sas proches ne sont jamais ouverts ensemble)' : '') + w;
  if (B.door === 'holo') return 'Porte holographique : ' + (B.doorOpen ? 'éteinte, l\'air passe (il lui faut du courant)' : 'champ allumé : on le traverse, l\'air reste') + w;
  if (B.door) return B.name.replace(' (ouverte)', '') + ' : ' + (B.doorOpen ? 'ouverte (courant)' : 'fermée (pas de courant)') + ' · elle suit le courant (levier, fil)' + w;
  if (B.mech) return BLOCKS[B.offId].name + ' : ' + (B.on ? 'alimenté' + (lvl < 15 ? ' à ' + lvl + ' / 15' : '') : 'sans courant') + ' · ' + MECH_HELP[B.mech] + w;
  if (B.inertia) return BLOCKS[B.offId].name + ' : ' + (B.on ? 'alimenté' : 'sans courant') + (B.inertia === 'accent' ? ' · sur un objet, ses moteurs poussent plus fort' : ' · sur un objet, la dérive et la rotation s\'éteignent sans commande') + w;
  if (B.gear) return B.name + " : sur un objet, il amortit l'atterrissage (pas de rebond, pas de bascule)" + w;
  if (welded) return B.name + " : joint soudé (il arrête l'air)";
  return null;
}
// Ouvre ou ferme une porte à la main (sas, porte étanche) ; get / set : le monde ou l'objet
function toggleDoor(get, set, q, r, y) {
  const b = BLOCKS[get(q, r, y)], open = !b.doorOpen;
  if (open && b.door === 'airlock') {
    const others = otherAirlocks(get, BLOCKS, q, r, y, doorGroup(get, BLOCKS, q, r, y));
    for (const c of others) setDoor(get, set, BLOCKS, ...c, false);
    if (others.length) toast("Sas : l'autre porte se ferme d'abord");
  }
  setDoor(get, set, BLOCKS, q, r, y, open);
  playClick();
}
function structWatts(s, k) {
  const id = s.blocks.get(k), B = BLOCKS[id];
  if (!B) return null;
  { const t = sealText(id, orbital.welded(k, s), s.lvl?.get(k) ?? 15); if (t) return t; }
  if (isAnalog(id)) return analogText(id);
  if (isWheel(id) || isCarSeat(id) || isRoutePilot(id)) return carText(s, k, id);
  if (B.turret) return turretText(id, weapons.teamOfStruct(s));
  const o = orbital.describeStruct(s, k);
  if (o) return o;
  const R = s.rocket, fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  if (R && (B.thrust || B.rocketTank || id === REACTOR || id === COCKPIT)) {
    const fuel = net.isClient ? null : rockets.fuel(s), tank = fuel === null ? '' : '\nCarburant de la fusée : ' + fmt(fuel) + ' / ' + fmt(R.cap) + ' mB';
    if (B.rocketTank) return B.name + (net.isClient ? '' : ' : ' + fmt(s.params.get(k)?.[0] || 0) + ' / ' + fmt(B.cap) + ' mB') + tank;
    if (B.thrust) {
      const on = R.active.some(([q, r, y]) => q + ',' + r + ',' + y === k);
      return B.name + ' : ' + (on ? 'alimentée' + (s.firing > 0 ? ', ' + Math.round(s.firing * 100) + ' % des gaz' : ', gaz coupés') : 'pas alimentée (un réacteur armé pour 4 tuyères)') + tank;
    }
    if (id === REACTOR) {
      const [q, r, y] = k.split(',').map(Number), armed = AROUND_ONE.some(([a, b, c]) => s.blocks.get((q + a) + ',' + (r + b) + ',' + (y + c)) === NEDROLYTIUM);
      return B.name + ' : ' + (armed ? 'armé (il touche un bloc de nédrolytium)' : 'pas armé : il doit toucher un bloc de nédrolytium') + ' · ' + R.armed + '/' + R.reactors + ' armé(s) à bord' + tank;
    }
    return B.name + " : clic droit pour s'asseoir · " + R.active.length + '/' + R.nozzles.length + ' tuyère(s) alimentée(s)' + tank;
  }
  if (isPropeller(id)) {
    const lvl = s.lvl?.get(k) ?? 15, rotor = structs.rotorOf(s.id, k), rpm = rotor?.hinge ? Math.round((Math.abs(rotor.hinge.w) / (Math.PI * 2)) * 60) : 0;
    return 'Hélice : ' + (id === PROPELLER_ON ? 'alimentée' + (lvl < 15 ? ' à ' + lvl + ' / 15' : '') + (rotor ? ' · ' + rpm + ' tours/min' : '') : 'sans courant');
  }
  if (B.power || B.machine) return B.name + " : à l'arrêt sur un objet collé (les machines ne tournent que posées dans le monde, reliées à un réseau)";
  return null;
}
// Levier analogique : un cran de plus (Maj : de moins), dit à l'écran
function analogStep(id, down) {
  const lv = Math.max(0, Math.min(15, id - ANALOG + (down ? -1 : 1)));
  toast('Levier analogique : ' + lv + ' / 15' + (lv === 15 ? ' (pleine puissance)' : lv ? '' : ' (coupé)'));
  playClick();
  return ANALOG + lv;
}
// Voiture (voir cars.js) : ce qu'on lit en visant une roue, le volant, le pilote de route
function carText(s, k, id) {
  const C = s.car;
  if (!C) return BLOCKS[id].name + " : pas de roue sous l'objet";
  const avant = C.fwdL ? '' : " · pas de volant ni de pilote de route : les roues roulent dans tous les sens";
  if (isWheel(id)) return 'Roue : ' + (C.lv ? 'motrice, puissance ' + C.lv + ' / 15 (' + Math.round(((CAR_VMAX * C.lv) / 15) * 3.6) + ' km/h au plus)' : 'libre (sans courant)') + ' · ' + C.wheels + ' roue' + (C.wheels > 1 ? 's' : '') + avant;
  if (isCarSeat(id)) return 'Volant : clic droit pour conduire · ' + C.wheels + ' roue' + (C.wheels > 1 ? 's' : '') + (C.lv ? ', puissance ' + C.lv + ' / 15' : ', sans courant') + ' · ' + Math.round(Math.abs(C.v) * 3.6) + ' km/h';
  const P = s.pilot, a = s.auto;
  const st = !s.params.get(k) ? 'pas réglé (clé à molette)' : !C.lv ? 'les roues ne reçoivent pas de courant' : !P ? 'en attente' : a?.end ? 'arrivé' : a?.waitT > 0 ? 'arrêt ' + Math.ceil(a.waitT) + ' s' : 'en route vers ' + Math.round(P.target.x) + ' / ' + Math.round(P.target.z) + (P.route.length > 1 ? ' (étape ' + (a.leg + 1) + ' / ' + P.route.length + ')' : '');
  return 'Pilote de route : ' + st;
}
// Tourelle (voir weapons.js) : son équipe, sa portée, ce qu'il lui faut
function turretText(id, team) {
  const B = BLOCKS[id], T = TURRETS[B.turret];
  const need = B.turret === 'laser' ? 'la charge des accumulateurs (dans le monde : du courant)' : B.turret === 'gun' ? 'des balles dans une chambre de chargement' : 'des missiles dans une chambre de chargement';
  return B.name + ' : ' + (team ? 'équipe ' + teamOf(team).name + ', ' : 'sans équipe (elle ne tire pas), ') + 'portée ' + T.range + ' blocs · ' + (survival.on ? 'il lui faut ' + need : 'munitions infinies en créatif') + " · clé à molette : changer d'équipe";
}
const analogText = (id) => 'Levier analogique : ' + (id - ANALOG) + ' / 15 · clic droit : +1, Maj + clic droit : -1 (maintenu : il défile)';

function updateWatts() {
  const now = performance.now();
  if (now - wattsT < 250) return;
  wattsT = now;
  const { q, r, y } = target?.hit || {};
  const ts = targetStruct, sk = ts && ts.hit.q + ',' + ts.hit.r + ',' + ts.hit.y;
  const aimedA = !hideUi && !ts && target ? world.getBlock(q, r, y) : 0;
  const sealed = !hideUi && !ts && target ? sealText(aimedA, orbital.welded(q + ',' + r + ',' + y), circuits.propLvl.get(q + ',' + r + ',' + y) ?? 15) : null;
  const text = hideUi ? null : ts ? structWatts(ts.struct, sk) : !target ? null : sealed ? sealed : isAnalog(aimedA) ? analogText(aimedA)
    : BLOCKS[aimedA]?.turret ? turretText(aimedA, weapons.worldTeam(q + ',' + r + ',' + y))
    : isWheel(aimedA) || isCarSeat(aimedA) || isRoutePilot(aimedA) ? BLOCKS[aimedA].name + ' : colle-le à un objet (Super colle) pour faire une voiture : des roues dessous, un volant ou un pilote de route pour donner l\'avant'
    : net.isClient ? industry.remoteDescribe(q, r, y, () => net.csend({ t: 'indq', a: 'ask', q, r, y }))
    : industry.describe(q, r, y);
  wattsEl.classList.toggle('on', !!text);
  if (text) wattsEl.textContent = text;
}

function updateTarget() {
  updateLook();
  target = world.raycast(eye, lookDir, REACH);
  railAim = null;
  // un chariot plus proche que le bloc visé passe devant
  let hit = carts.raycast(eye, lookDir, REACH);
  // (une voiture de train compte comme un chariot : on la vise, on la casse, on y monte)
  const th = trains.raycast(eye, lookDir, REACH);
  if (th && (!hit || th.t < hit.t)) hit = th;
  targetCart = hit && (!target || hit.t < target.t) ? hit.cart : null;
  if (targetCart) target = null;
  const sh = structs.raycast(eye, lookDir, REACH);
  targetStruct = sh && (!target || sh.t < target.t) && (!hit || !targetCart || sh.t < hit.t) ? sh : null;
  if (targetStruct) { target = null; targetCart = null; }
  // un animal plus proche que tout le reste passe devant
  const ah = animals.raycast(eye, lookDir, REACH);
  const near = Math.min(target ? target.t : Infinity, hit && targetCart ? hit.t : Infinity, targetStruct ? targetStruct.t : Infinity);
  targetAnimal = ah && ah.t < near ? ah.animal : null;
  if (targetAnimal) { target = null; targetCart = null; targetStruct = null; }
  // un autre joueur (en ligne) passe devant tout le reste
  const ph = net.active ? raycastPlayers(eye, lookDir, REACH) : null;
  targetPlayer = ph && ph.t < Math.min(near, ah && targetAnimal ? ah.t : Infinity) ? ph.rp : null;
  if (targetPlayer) { target = null; targetCart = null; targetStruct = null; targetAnimal = null; }
  // un carton plus proche que tout le reste
  const ch = cartons.raycast(eye, lookDir, REACH);
  const nearest = Math.min(target ? target.t : Infinity, targetStruct ? targetStruct.t : Infinity, targetAnimal && ah ? ah.t : Infinity, targetCart && hit ? hit.t : Infinity, targetPlayer && ph ? ph.t : Infinity);
  const tc = ch && ch.t < nearest ? ch.carton : null;
  if (tc) { target = null; targetCart = null; targetStruct = null; targetAnimal = null; targetPlayer = null; }
  if (tc !== targetCarton) {
    targetCarton = tc;
    if (tc) showHint(cartonText(tc));
  }
  updateWatts();
  outline.visible = (!!target || !!targetStruct) && !hideUi;
  if (targetStruct) structs.placeOutline(outline, targetStruct.struct, targetStruct.hit.q, targetStruct.hit.r, targetStruct.hit.y);
  if (target) {
    const { x, z } = hexToWorld(target.hit.q, target.hit.r);
    outline.quaternion.identity();
    // contour aplati sur un rail, resserré autour d'une torche, d'une demi-hauteur sur une dalle
    const id = world.getBlock(target.hit.q, target.hit.r, target.hit.y);
    const [lo, hi] = blockBox(id);
    outline.position.set(x, target.hit.y + lo, z);
    if (isTorch(id)) {
      outline.scale.set(0.2, 0.65, 0.2);
      const w = BLOCKS[id].wall;
      if (w !== undefined) outline.position.set(x + Math.cos(w * Math.PI / 3) * 0.28, target.hit.y + 0.2, z + Math.sin(w * Math.PI / 3) * 0.28);
    }
    else if (BLOCKS[id]?.lever || BLOCKS[id]?.sapling) outline.scale.set(0.62, 0.75, 0.62);
    else if (BLOCKS[id]?.repeater) outline.scale.set(1, 0.33, 1); // plaque et plots
    else outline.scale.set(1, (isRail(id) || BLOCKS[id]?.track !== undefined) ? 0.12 : isWire(id) ? 0.06 : hi - lo, 1); // fil : contour plat, au ras du sol
  }
}

// ---------- Minage (survie) ----------
// Le bloc visé se casse après un temps qui dépend de sa matière et de l'outil tenu ; ce
// qu'il donne va dans l'inventaire.
const breakBar = document.getElementById('breakbar');
const breakFill = breakBar.firstElementChild;
const mining = { key: '', t: 0, swing: 0 };
function stopMining() {
  mining.key = '';
  mining.t = 0;
  breakBar.classList.remove('on');
}
function mine(dt) {
  if (spectator) return;
  let key = '', id = 0;
  if (targetStruct) {
    const h = targetStruct.hit;
    key = `s${targetStruct.struct.id}:${h.q},${h.r},${h.y}`;
    id = targetStruct.struct.blocks.get(h.q + ',' + h.r + ',' + h.y);
  } else if (target) {
    const h = target.hit;
    key = `${h.q},${h.r},${h.y}`;
    id = world.getBlock(h.q, h.r, h.y);
  }
  if (!key || !BLOCKS[id] || BLOCKS[id].unbreakable || (!targetStruct && tutoLocked(id))) { stopMining(); return; }
  if (key !== mining.key) { mining.key = key; mining.t = 0; }
  const tool = hotbar[slot]; // objet tenu (outil ou non)
  const need = breakTime(id, tool);
  mining.t += dt;
  mining.swing -= dt;
  if (mining.swing <= 0) {
    hand.punch();
    mining.swing = 0.25;
    playDig(matterOf(id));
    if (target && !targetStruct) fx.dig(eye.clone().addScaledVector(lookDir, target.t - 0.05), id, lookDir.clone().negate());
  }
  breakBar.classList.add('on');
  breakFill.style.width = `${Math.min(100, (mining.t / need) * 100)}%`;
  if (mining.t < need) return;
  // (deux dalles dans la case : on ne casse que la moitié visée)
  const drop = dropOf(BLOCKS[id]?.dslab && !targetStruct ? aimedSlabPart(id)[0] : id, tool);
  breakBlock();
  // (blé mûr : des graines en plus, à ressemer)
  const extra = extraDrop(id);
  if (extra && survival.give(extra[0], extra[1])) toast('Inventaire plein');
  if (drop) {
    // (un wagonnet de mine tout près : dedans)
    const w = target ? hexToWorld(target.hit.q, target.hit.r) : null;
    const n = mineWagonTake(drop[0], drop[1], w && new THREE.Vector3(w.x, target.hit.y + 0.5, w.z));
    const left = n ? survival.give(drop[0], n) : 0;
    // (inventaire plein : ce qui ne rentre pas tombe dans un carton, là où était le bloc)
    if (left && target) { const w = hexToWorld(target.hit.q, target.hit.r); spawnCarton(new THREE.Vector3(w.x, target.hit.y + 0.2, w.z), [{ id: drop[0], n: left }], null, 1.5); toast('Inventaire plein : le reste tombe dans un carton'); }
    else if (left) toast('Inventaire plein');
  }
  // l'outil tenu s'use (pas sur ce qui se casse d'un coup ; l'épée s'use deux fois plus)
  if (need > 0.05) wearHeld(ITEMS[tool]?.tool === 'sword' ? 2 : 1);
  stopMining();
}

// Lance une boule de neige droit devant (le système est créé au premier lancer : l'icône doit être prête)
function throwSnowball() {
  snowballs ||= new SnowballSystem(scene, world, items.icon(SNOWBALL, 32));
  updateLook(); // position et direction du regard à cet instant
  const from = eye.clone().addScaledVector(lookDir, 0.4);
  from.y -= 0.1;
  snowballs.throw(from, lookDir, player.vel);
  useHeld(); // en survie, une boule de moins
}

// ---------- Mines abandonnées (voir gen.js : mineBlock) ----------
// Coffre d'une mine abandonnée : rempli à sa première ouverture (s'il est encore celui du monde)
const MINE_LOOT = [
  [IRON_INGOT, 2, 6, 1], [TRACK_IDS[0], 4, 12, 0.9], [23, 4, 10, 0.8], [104, 3, 8, 0.7], [BREAD, 1, 3, 0.6],
  [FLUORITE_INGOT, 1, 3, 0.35], [PLATINUM_INGOT, 1, 2, 0.2], [VOLTITE, 2, 6, 0.4], [MINE_WAGON, 1, 1, 0.15], [HELMET_LAMP, 1, 1, 0.2],
];
// Coffre de l'épave du Traveler-98 : sa planchette futuriste (la fiche : voir lore.js), et ce qui reste du bord
const PLANCHETTE_DOC = 319, PLANCHETTE_CORRUPTED = 321;
const WRECK_LOOT = [[IRON_INGOT, 2, 5, 0.8], [PLATINUM_INGOT, 1, 3, 0.5], [TUNGSTEN_INGOT, 1, 3, 0.4], [FLUORITE_INGOT, 1, 2, 0.35], [NEDROLYTIUM, 1, 1, 0.25]];
containers.onCreate = (q, r, y, box) => {
  const doc = box.type === 'chest' && y >= 0 ? world.gen.isWreckChest?.(q, r, y) : 0;
  if (doc) {
    if (world.getBlock(q, r, y) !== world.gen.block(q, r, y)) return;
    box.looted = true;
    box.slots[0] = doc > 0 && ITEMS[LORE_ITEM + doc] ? makeSlot(LORE_ITEM + doc, 1) : makeSlot(PLANCHETTE_CORRUPTED, 1);
    let i = 1;
    for (const [id, a, b, chance] of WRECK_LOOT) {
      if (Math.random() > chance || i >= box.slots.length) continue;
      box.slots[i++] = makeSlot(id, a + Math.floor(Math.random() * (b - a + 1)));
    }
    return;
  }
  if (box.type !== 'chest' || y >= 0 || !world.gen.isMineChest?.(q, r, y)) return;
  if (world.getBlock(q, r, y) !== world.gen.block(q, r, y)) return; // (un coffre posé par un joueur)
  box.looted = true;
  let i = 0;
  for (const [id, a, b, chance] of MINE_LOOT) {
    if (Math.random() > chance || i >= box.slots.length) continue;
    box.slots[i++] = makeSlot(id, a + Math.floor(Math.random() * (b - a + 1)));
  }
};
// Wagonnet de mine (hôte, solo) : ce qu'on casse à moins de WAGON_REACH blocs tombe dedans ;
// renvoie ce qui n'y est pas entré
const WAGON_REACH = 7;
function mineWagonTake(id, n, at) {
  if (net.isClient || !at) return n;
  for (const c of trains.cars) {
    if (c.kind !== 'mine' || !c.box || c.pos.distanceTo(at) > WAGON_REACH) continue;
    n = putIn(c.box, makeSlot(id, n));
    if (!n) { toast('Dans le wagonnet'); return 0; }
  }
  return n;
}

// Survie : l'outil tenu s'use (et casse au bout de sa durabilité, voir blocks.js)
function wearHeld(n) {
  const broke = survival.wear(slot, n);
  if (broke) { toast(`Ta ${broke.toLowerCase()} s'est cassée !`); playToolBreak(); } // (pioche, hache, pelle, épée, houe : toutes féminines)
}

// Survie : le bloc posé est retiré de la case tenue
function useHeld() {
  if (BLOCKS[hotbar[slot]]) commands.note('used', hotbar[slot]);
  if (survival.on && fairPlay() && BLOCKS[hotbar[slot]] && !ITEMS[hotbar[slot]]?.train) account.track('placed', 1);
  if (survival.on) survival.take(slot, 1);
}

// Coup porté à l'animal visé (avec l'objet tenu) ; ce qu'il laisse va dans l'inventaire
function attackAnimal() {
  if (spectator) return;
  const a = targetAnimal;
  if (!a) return;
  const dmg = attackDamage(hotbar[slot]);
  if (ITEMS[hotbar[slot]]?.tool) wearHeld(ITEMS[hotbar[slot]].tool === 'sword' ? 1 : 2); // (l'épée est faite pour ça)
  if (net.isClient) { net.csend({ t: 'ahit', id: a.id, d: dmg }); return; }
  const drop = animals.hit(a, dmg, player.pos.x, player.pos.z, options.pseudo);
  if (drop && survival.on && survival.give(drop[0], drop[1])) toast('Inventaire plein');
  // (le mouton laisse aussi sa viande)
  if (drop && a.meat && survival.on && survival.give(a.meat[0], a.meat[1])) toast('Inventaire plein');
  if (a.dead && a.type === 'zombie' && !a.counted) { a.counted = true; zombieKilled(a); }
}
// Succès : un zombie tué par le joueur (près d'un village : il le défend)
function zombieKilled(a) {
  account.unlock('zombie');
  if (account.bump('zombies') >= 100) account.unlock('tueur');
  const near = [...animals.colony.villages.values()].some((V) => Math.hypot(a.pos.x - V.x, a.pos.z - V.z) < (V.wallR ? V.wallR * 0.866 : 40) + 12);
  if (near && account.bump('zombiesVillage') >= 10) account.unlock('defenseur');
}

function breakBlock() {
  if (spectator || targetAnimal || targetPlayer) return; // (un animal, un joueur se frappent d'un clic)
  if (targetStruct) {
    const { struct: s, hit } = targetStruct;
    const id = s.blocks.get(hit.q + ',' + hit.r + ',' + hit.y);
    if (!BLOCKS[id]?.unbreakable) {
      // coffre / four de l'objet : son contenu revient dans l'inventaire (perdu en créatif)
      if (BLOCKS[id]?.container && !net.isClient) {
        let full = false;
        for (const it of containers.takeKey('S' + s.id + ':' + hit.q + ',' + hit.r + ',' + hit.y)) if (survival.on && survival.give(it.id, it.n, it.w)) full = true;
        if (full) toast('Inventaire plein : des objets ont été perdus');
      }
      playBreak(matterOf(id));
      if (net.isClient) net.csend({ t: 'sset', id: s.id, q: hit.q, r: hit.r, y: hit.y, b: AIR });
      else structs.setBlock(s, hit.q, hit.r, hit.y, AIR);
    }
    targetStruct = null;
    return;
  }
  if (targetCart?.isTrain) {
    // (la locomotive : tout le train revient ; un wagon : lui seul) — en ligne, l'hôte s'en charge
    if (net.isClient) { net.csend({ t: 'tr', a: 'remove', id: targetCart.id }); targetCart = null; return; }
    const at = targetCart.pos.clone();
    giveBack(trains.removeCar(targetCart), at);
    targetCart = null;
    return;
  }
  if (targetCart) {
    if (net.isClient) net.cartAction('remove', { cart: targetCart }); else carts.remove(targetCart);
    targetCart = null;
    if (survival.on) survival.give(HEXACART, 1);
    return;
  }
  if (!target) return;
  const { q, r, y } = target.hit;
  const b = BLOCKS[world.getBlock(q, r, y)];
  // (la bedrock se casse en créatif, jamais en survie)
  if (!b || (b.unbreakable && !(world.getBlock(q, r, y) === BEDROCK && !survival.on))) return;
  if (tutoLocked(world.getBlock(q, r, y))) { toast('La coque de la station est bien trop solide'); return; }
  // coffre / four : son contenu revient dans l'inventaire (perdu en créatif)
  if (b.container) {
    let full = false;
    for (const s of containers.take(q, r, y)) if (survival.on && survival.give(s.id, s.n, s.w)) full = true;
    if (full) toast('Inventaire plein : des objets ont été perdus');
  }
  // photo accrochée : elle revient avec son numéro
  if (b.photo) { const id = photos.frames.get(q + ',' + r + ',' + y)?.id; if (survival.on && id && survival.give(PHOTO, 1, id)) toast('Inventaire plein : la photo est perdue'); }
  // (éclats et bruit de la matière)
  { const c = hexToWorld(q, r), id = world.getBlock(q, r, y); fx.breakBlock(c.x, y, c.z, id); playBreak(matterOf(id)); }
  // deux dalles : la moitié visée s'en va, l'autre reste
  if (survival.on) commands.note('mined', world.getBlock(q, r, y));
  world.setBlock(q, r, y, b.dslab ? aimedSlabPart(world.getBlock(q, r, y))[1] : AIR);
  if (survival.on && fairPlay()) account.track('broken', 1);
  // lit de villageois : l'autre moitié s'en va avec
  if (b.pod !== undefined) { const oy = b.podTop ? y - 1 : y + 1; if (isPod(world.getBlock(q, r, oy))) world.setBlock(q, r, oy, AIR); }
  // porte étanche : l'autre moitié s'en va avec
  if (b.door === 'seal') { const oy = b.doorTop ? y - 1 : y + 1, o = BLOCKS[world.getBlock(q, r, oy)]; if (o?.door === 'seal' && !!o.doorTop !== !!b.doorTop) world.setBlock(q, r, oy, AIR); }
  updateTarget();
}

// Bloc « deux dalles » visé : [moitié visée, moitié qui reste] (d'après le point visé)
function aimedSlabPart(id) {
  const h = target.hit, c = hexToWorld(h.q, h.r);
  // (un peu plus loin que l'entrée du rayon dans la case : on est bien dans la moitié touchée)
  const t = target.t + 0.03;
  return slabPartAt(id, eye.x + lookDir.x * t - c.x, eye.y + lookDir.y * t - h.y, eye.z + lookDir.z * t - c.z);
}

// ---------- Photos (voir photos.js) ----------
let photoShot = null; // (prise demandée : faite juste après le prochain rendu de la scène)
function takePhoto() {
  if (photoShot) return;
  // (en survie : une feuille de papier photo par photo)
  const paper = survival.on ? survival.slots.findIndex((s) => s?.id === PHOTO_PAPER) : -1;
  if (survival.on && paper < 0) { toast('Il faut du papier photo (3 blés et un charbon)'); return; }
  photoShot = (canvas) => {
    const id = photos.capture(canvas);
    playClick();
    flashScreen();
    if (!survival.on) { toast("Photo prise : une Photo de l'inventaire accroche la dernière prise"); return; }
    survival.take(paper, 1);
    if (survival.give(PHOTO, 1, id)) giveBack([{ id: PHOTO, n: 1, w: id }], player.pos);
    toast("Photo prise ! Clic droit avec la photo sur un mur pour l'accrocher");
  };
}
function flashScreen() {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0.85;pointer-events:none;z-index:50;transition:opacity 0.45s ease-out';
  document.body.appendChild(d);
  requestAnimationFrame(() => requestAnimationFrame(() => { d.style.opacity = '0'; }));
  setTimeout(() => d.remove(), 600);
}
// La photo tenue (son numéro ; en créatif : la dernière prise)
const heldPhoto = () => (survival.on ? survival.slots[slot]?.w || 0 : photos.last);
function usePhoto() {
  const id = heldPhoto();
  if (!id || !photos.images.has(id)) { toast(survival.on ? 'Cette photo est blanche' : "Prends d'abord une photo avec l'appareil photo"); return; }
  // visée sur le côté d'un bloc : accrochée à ce mur ; sinon, on la regarde en grand
  if (target && !targetCart && target.prev && target.prev.y === target.hit.y) {
    const { q, r, y } = target.prev, h = target.hit;
    const k = NEIGHBORS.findIndex(([a, b]) => q + a === h.q && r + b === h.r);
    if (k >= 0 && world.getBlock(q, r, y) === AIR && SOLID[world.getBlock(h.q, h.r, h.y)]) {
      if (!world.setBlock(q, r, y, PHOTO_FRAME + k)) return;
      photos.hang(q, r, y, k, id);
      if (survival.on) survival.take(slot, 1);
      playPlace('wood');
      updateTarget();
      return;
    }
  }
  showPhoto(id);
}
function showPhoto(id) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);z-index:40';
  const img = new Image();
  img.src = photos.images.get(id);
  img.style.cssText = 'width:min(70vw,90vh*4/3);image-rendering:auto;border:14px solid #f4f0e6;border-bottom-width:42px;box-shadow:0 10px 40px rgba(0,0,0,0.6);transform:rotate(-1.5deg)';
  d.appendChild(img);
  document.body.appendChild(d);
  const close = () => { d.remove(); removeEventListener('mousedown', close, true); removeEventListener('keydown', close, true); };
  setTimeout(() => { addEventListener('mousedown', close, true); addEventListener('keydown', close, true); }, 150);
}

// Lecture d'une planchette futuriste (clic droit) : sa fiche en grand, et seulement la sienne
// (molette : faire défiler ; clic ou touche : refermer)
function readPlanchette() {
  let md;
  if (hotbar[slot] === PLANCHETTE_CORRUPTED) md = CORRUPTED;
  else {
    const id = loreDoc(hotbar[slot]) || (survival.on ? survival.slots[slot]?.w || 0 : 0);
    md = LORE[id]?.text;
    if (!md) { toast('Cette planchette est vide'); return; }
  }
  const d = document.createElement('div');
  d.className = 'lore-view';
  d.innerHTML = '<div class="lore-page">' + loreHtml(md) + '<div class="lore-hint">Molette : défiler — clic ou touche : fermer</div></div>';
  document.body.appendChild(d);
  const page = d.firstChild;
  const wheel = (e) => { page.scrollTop += e.deltaY; e.stopImmediatePropagation(); e.preventDefault(); };
  const close = () => { d.remove(); removeEventListener('mousedown', close, true); removeEventListener('keydown', close, true); removeEventListener('wheel', wheel, true); };
  addEventListener('wheel', wheel, { capture: true, passive: false });
  setTimeout(() => { addEventListener('mousedown', close, true); addEventListener('keydown', close, true); }, 150);
}

function placeBlock() {
  // (la voie d'une ligne spatiale se vise comme un rail : on y pose un wagon, on construit à côté)
  if (!target && !targetCart && !targetStruct && !targetAnimal && !targetPlayer && !targetCarton) target = tracks.aimLong(eye, lookDir, REACH);
  if (spectator) return;
  // dans la cabine, du combustible en main : on le met dans la locomotive
  if (player.riding?.kind === 'loco' && survival.on && canFuel(player.riding, hotbar[slot])) { refuelLoco(player.riding); return; }
  // un chapeau en main : on le met (l'ancien revient dans la main)
  if (ITEMS[hotbar[slot]]?.wear === 'head') { equipHeld(); return; }
  // appareil photo : on prend la vue ; une photo : on l'accroche au mur visé (ou on la regarde)
  if (hotbar[slot] === CAMERA) { takePhoto(); return; }
  if (hotbar[slot] === PHOTO) { usePhoto(); return; }
  // planchette futuriste : on lit sa fiche
  if (hotbar[slot] === PLANCHETTE_DOC || hotbar[slot] === PLANCHETTE_CORRUPTED || loreDoc(hotbar[slot])) { readPlanchette(); return; }
  // clic droit sur un villageois (adulte) : commerce
  if (targetAnimal) {
    if (targetAnimal.type === 'villager' && !targetAnimal.dead) {
      // accroupi, un objet à la main : on le lui offre (pour se faire pardonner)
      if (Controls.held(keys, 'down') && hotbar[slot]) giftVillager(targetAnimal);
      // il a peur de nous : il refuse de commercer
      else if (animals.talk.mood(targetAnimal, options.pseudo) === 'afraid') {
        animals.talk.say(targetAnimal, 'leave');
        toast('Ce villageois a peur de toi : il refuse de commercer. Offre-lui quelque chose pour te faire pardonner (accroupi + clic droit, l\'objet en main)');
      } else openTrade(targetAnimal);
    }
    return;
  }
  // clic droit sur un aiguillage (sans rail de train ni train en main) : il bascule
  if (target && !targetCart && hotbar[slot] !== TRACK_IDS[0] && !ITEMS[hotbar[slot]]?.train) {
    const h = target.hit, n = isTrack(world.getBlock(h.q, h.r, h.y)) && tracks.nodes.get(h.q + ',' + h.r + ',' + h.y);
    if (n && tracks.isSwitch(n) && toggleSwitch(n)) return;
  }
  // clic droit sur un chariot : on monte dedans
  if (targetCart) {
    if (player.riding) return;
    // locomotive : on monte dans la cabine pour conduire ; wagon : son inventaire
    if (targetCart.isTrain) {
      const k = targetCart.kind;
      if (k === 'wagon' || k === 'hopper' || k === 'layer' || k === 'tender' || k === 'covered' || k === 'mine') openBox(0, 0, 0, null, null, targetCart.box || {}, 'T' + targetCart.id);
      else if (k === 'armored') {
        // wagon blindé : on s'assoit sur la tourelle (invité : tout de suite, l'hôte confirme)
        if ((targetCart.riderPid ?? -1) >= 0 || targetCart.rider) { toast('Quelqu\'un est déjà à la tourelle'); return; }
        if (net.isClient) { net.csend({ t: 'tr', a: 'mount', id: targetCart.id }); targetCart.rider = player; player.riding = targetCart; player.fly = false; }
        else trains.mount(targetCart, player);
        toast('Tourelle : vise avec la souris, clic gauche pour tirer' + (survival.on ? ' (un obus à chaque tir)' : ''));
      }
      else if (k === 'passenger') {
        // wagon passagers : une place libre (invité : on s'assoit tout de suite, l'hôte confirme)
        if (net.isClient) {
          const i = Array.isArray(targetCart.seatPids) ? targetCart.seatPids.findIndex((p) => p === -1) : 0;
          if (i < 0) { toast('Toutes les places sont prises'); return; }
          net.csend({ t: 'tr', a: 'mount', id: targetCart.id, seat: i });
          targetCart.seats[i] = player;
          player.seat = i;
          player.riding = targetCart;
          player.fly = false;
        } else if (!trains.mount(targetCart, player)) toast('Toutes les places sont prises');
      } else if (k === 'loco' && survival.on && canFuel(targetCart, hotbar[slot])) refuelLoco(targetCart);
      else if ((k === 'loco' || k === 'tail') && net.isClient) {
        // (invité : on s'assoit tout de suite, l'hôte confirme ; s'il refuse, on ressort)
        if (player.riding || (targetCart.riderPid ?? -1) >= 0) return;
        net.csend({ t: 'tr', a: 'mount', id: targetCart.id });
        targetCart.rider = player;
        player.riding = targetCart;
        player.fly = false;
        player.yaw = Math.atan2(-targetCart.dir.x, -targetCart.dir.z) + (k === 'tail' ? Math.PI : 0);
        mountedCab(targetCart);
      } else if ((k === 'loco' || k === 'tail') && trains.mount(targetCart, player)) mountedCab(targetCart);
      return; // (wagon plat : on construit sur son plateau, comme sur un objet physique)
    }
    if (net.isClient) net.cartAction('mount', { cart: targetCart }); else if (!targetCart.rider) carts.mount(targetCart, player);
    return;
  }
  const item = hotbar[slot];
  // bloc posé par l'objet tenu (la voltite se pose en fil)
  const block = ITEMS[item]?.places ?? item;
  const shift = Controls.held(keys, 'down');
  if (item === WRENCH) {
    wrenchClick();
    return;
  }
  if (item === SCHEMATIC) { schemRight(shift); return; }
  // émetteur / récepteur sans fil visé (sans être accroupi) : sa fréquence devient l'objet en main
  if (target && !shift && isRadio(world.getBlock(target.hit.q, target.hit.r, target.hit.y))) { radioClick(item); return; }
  if (target && !shift && orbital.click(target.hit.q, target.hit.r, target.hit.y, item)) return;
  if (item === BELT && !shift) { beltLink(); return; }
  // nourriture : on la mange (en survie, quand on a faim ou qu'il manque de la vie) ; une pomme
  // de terre visée sur le dessus d'une terre labourée, elle, se plante
  const sows = ITEMS[item]?.places && target?.prev && isFarmland(world.getBlock(target.hit.q, target.hit.r, target.hit.y)) && target.prev.y === target.hit.y + 1;
  if (ITEMS[item]?.food && !sows) {
    if (survival.on && survival.canEat()) {
      survival.eat(ITEMS[item].food);
      playEat();
      fx.crumbs(eye.clone().addScaledVector(lookDir, 0.6).add(new THREE.Vector3(0, -0.25, 0)), item);
      tutorial.event('eat');
      account.unlock('manger');
      useHeld();
      hand.punch();
    }
    return;
  }
  if (item === SNOWBALL) {
    throwSnowball();
    return;
  }
  // œuf d'Hexalien : il apparaît dans la case visée (chez soi, pas d'envoi en ligne : voir hexaliens.js)
  if (ITEMS[item]?.hexEgg) {
    if (!target || !target.prev) return;
    const p = target.prev, w = hexToWorld(p.q, p.r);
    hexaliens.spawnAt(w.x, p.y, w.z);
    world.changed = true;
    useHeld();
    hand.punch();
    return;
  }
  // œuf d'apparition : l'animal apparaît dans la case visée (sur le bloc)
  if (ITEMS[item]?.egg) {
    if (!target || !target.prev) return;
    const p = target.prev, w = hexToWorld(p.q, p.r), type = ITEMS[item].egg;
    if (net.isClient) net.csend({ t: 'aegg', k: type, x: w.x, y: p.y, z: w.z });
    else animals.spawnAt(type, w.x, p.y, w.z);
    useHeld();
    hand.punch();
    return;
  }
  if (item === GLUE) {
    useGlue(shift);
    return;
  }
  if (item === DOUBLE_GLUE) {
    useDoubleGlue();
    return;
  }
  if (item === ROPE) {
    useRope(shift);
    return;
  }
  if (item === GRAVITY_HAND) {
    if (grab) { releaseGrab(); return; }
    // portée plus longue que pour construire (sans traverser un bloc du monde)
    const far = targetStruct || structs.raycast(eye, lookDir, GRAB_MAX);
    const wall = far && world.raycast(eye, lookDir, far.t);
    if (far && !(wall && wall.t < far.t)) startGrab(far);
    else toast('Vise un objet collé pour l\'attraper');
    return;
  }
  if (targetStruct) {
    const { struct: s, prev, hit } = targetStruct;
    if (!shift && orbital.clickStruct(s, hit.q + ',' + hit.r + ',' + hit.y, item)) return;
    // clic droit sur une torche d'énergie de l'objet : l'allume / l'éteint (moteur en marche / arrêt)
    const k = hit.q + ',' + hit.r + ',' + hit.y, aimedId = s.blocks.get(k);
    // poste de pilotage : on s'y assoit (Maj : poser un bloc dessus)
    if (!shift && aimedId === COCKPIT) { sitPilot(s, k); return; }
    if (!shift && aimedId === PASSENGER_SEAT) { sitPassenger(s, k); return; }
    if (!shift && isCarSeat(aimedId)) { sitDriver(s, k); return; }
    // bidon de carburant sur un réservoir de fusée : il s'y vide (un bidon de carburant de fusée,
    // voir liquids.js ROCKET_EQ : il vaut plus ou moins de carburant primaire)
    if (!shift && BLOCKS[aimedId]?.rocketTank && LIQUID_OF_CAN[item] && !ROCKET_EQ[LIQUID_OF_CAN[item]]) { toast(LIQUID_NAME[LIQUID_OF_CAN[item]] + ' : ça ne brûle pas dans une fusée'); return; }
    if (!shift && BLOCKS[aimedId]?.rocketTank && (item === FUEL_CANISTER || item === CANISTER || item === CREATIVE_CANISTER || ROCKET_EQ[LIQUID_OF_CAN[item]])) {
      const eqMb = Math.round(CAN_MB * (ROCKET_EQ[LIQUID_OF_CAN[item]] ?? 1));
      const cap = BLOCKS[aimedId].cap, level = () => Math.round(s.params.get(k)?.[0] || 0).toLocaleString('fr-FR') + ' / ' + cap.toLocaleString('fr-FR') + ' mB';
      if (net.isClient) {
        // (le carburant est chez l'hôte)
        if (item === CANISTER) { toast('Le carburant de la fusée se lit au poste de pilotage'); return; }
        if (item === CREATIVE_CANISTER) { net.csend({ t: 'rkfill', id: s.id, k, full: true }); toast('Réservoir rempli'); playClick(); return; }
        net.csend({ t: 'rkfill', id: s.id, k, mb: eqMb });
        if (survival.on) { survival.take(slot, 1); if (survival.give(CANISTER, 1)) toast('Inventaire plein'); }
        toast('Bidon vidé dans le réservoir'); playClick();
        return;
      }
      if (item === CANISTER) { toast(BLOCKS[aimedId].name + ' : ' + level()); return; }
      if (item === CREATIVE_CANISTER) { rockets.fill(s, k, cap); toast('Plein : ' + level()); playClick(); structs.changed?.(s); return; }
      const n = rockets.fill(s, k, eqMb);
      if (n < eqMb) { if (n > 0) rockets.fill(s, k, -n); toast('Ce réservoir est plein'); return; }
      if (survival.on) { survival.take(slot, 1); if (survival.give(CANISTER, 1)) toast('Inventaire plein'); }
      toast('Plein : ' + level()); playClick(); structs.changed?.(s);
      return;
    }
    // table de craft, coffre ou four de l'objet : comme dans le monde (Maj : poser un bloc dessus)
    if (!shift && survival.on && aimedId === CRAFTING_TABLE) { openCraft(3); return; }
    if (!shift && BLOCKS[aimedId]?.container) { openBox(0, 0, 0, s, k); return; }
    // lit de villageois de l'objet : on s'y couche (Maj : poser un bloc dessus)
    if (!shift && isPod(aimedId)) { sleepInPod(hit.q, hit.r, hit.y, s); return; }
    // torche en main sur une TNT de l'objet : on l'allume (elle s'en détache)
    if (isTnt(aimedId) && (item === TORCH || item === ENERGY_TORCH)) {
      if (net.isClient) net.csend({ t: 'signite', id: s.id, k });
      else structs.igniteTnt(s, k);
      return;
    }
    if (item === WELDER) {
      if (net.isClient) { toast("La soudure de joint se fait chez l'hôte de la partie"); return; }
      toast(orbital.weld(k, s) ? "Joint soudé : ce bloc arrête l'air" : 'Soudure retirée');
      playClick();
      return;
    }
    if ((BLOCKS[aimedId]?.door === 'seal' || BLOCKS[aimedId]?.door === 'airlock') && !shift) {
      const get = (a, b, c) => s.blocks.get(a + ',' + b + ',' + c) || 0;
      if (net.isClient) { toast("Les portes d'un objet collé s'ouvrent chez l'hôte de la partie"); return; }
      const set = (a, b, c, v) => s.blocks.set(a + ',' + b + ',' + c, v);
      toggleDoor(get, set, hit.q, hit.r, hit.y);
      structs.afterEdit(s);
      return;
    }
    if (TOGGLE[aimedId] && !shift && !net.isClient) {
      s.blocks.set(k, TOGGLE[aimedId]);
      structs.afterEdit(s);
      return;
    }
    if (isAnalog(aimedId) && !net.isClient) {
      const v = analogStep(aimedId, shift);
      if (v !== aimedId) { s.blocks.set(k, v); structs.afterEdit(s); }
      return;
    }
    // construire sur un objet collé (rails et torches : sur un bloc de l'objet)
    if (!prev || !block || !BLOCKS[block] || isWater(block)) return;
    if (BLOCKS[block].prop || isTrack(block)) { toast('Ce bloc se pose dans le monde, au bord de la voie'); return; }
    if (ATTACHED[block] && !s.solid.has(prev.q + ',' + prev.r + ',' + (prev.y - 1))) { toast("Pose-le sur le dessus d'un bloc"); return; }
    if (structs.occupies(s, prev.q, prev.r, prev.y, player)) return;
    // blocs orientés (répéteur, four, coffre) : tournés vers le joueur, dans le repère de
    // l'objet (qui peut être tourné)
    const L = structs.toLocal(s, player.pos, new THREE.Vector3());
    let at = prev, sb = facingVariant(BLOCKS[block].placedAs ?? block, sideToward(prev.q, prev.r, L));
    // lit : deux blocs de haut, l'ouverture tournée vers le joueur (le haut vient avec, voir structs.setBlock)
    if (BLOCKS[block].pod !== undefined) {
      if (s.blocks.has(prev.q + ',' + prev.r + ',' + (prev.y + 1))) { toast('Pas assez de place : le lit fait deux blocs de haut'); return; }
      sb = POD + sideToward(prev.q, prev.r, L);
    }
    if (SLAB[block]) {
      // (dans le repère de l'objet : le point visé, et ses blocs)
      const P = structs.toLocal(s, eye.clone().addScaledVector(lookDir, targetStruct.t), new THREE.Vector3());
      const get = (q, r, y) => s.blocks.get(q + ',' + r + ',' + y) || AIR;
      const fill = slabToFill(block, targetStruct, get);
      if (fill) { at = fill; sb = fill.add; } // (setBlock complète la dalle)
      else sb = slabHalf(block, targetStruct, P);
    }
    if (at === prev && s.blocks.has(prev.q + ',' + prev.r + ',' + prev.y)) return;
    if (net.isClient) net.csend({ t: 'sset', id: s.id, q: at.q, r: at.r, y: at.y, b: sb });
    else if (!structs.setBlock(s, at.q, at.r, at.y, sb)) return;
    // (succès : 50 blocs construits sur un wagon plat)
    if (s.carrier && [...s.blocks.values()].filter((id) => !BLOCKS[id]?.deck).length >= 50) account.unlock('base_mobile');
    useHeld();
    playPlace(matterOf(sb));
    return;
  }
  if (item === TRACK_IDS[0]) { trackClick(shift); return; }
  if (ITEMS[item]?.train) {
    // locomotive (dans le sens du regard) ou wagon (derrière un train), sur un rail
    if (!target) { toast(ITEMS[item].train === 'loco' ? 'Pose la locomotive sur un rail' : 'Pose le wagon sur un rail, derrière une locomotive'); return; }
    const h = target.hit;
    // (invité : l'hôte pose le train ; il confirme, et l'objet quitte alors l'inventaire)
    if (net.isClient) { net.csend({ t: 'tr', a: ITEMS[item].train, q: h.q, r: h.r, y: h.y, yaw: player.yaw, st: ITEMS[item].style || '' }); return; }
    const err = ITEMS[item].train === 'loco' ? trains.spawnLoco(h.q, h.r, h.y, player.yaw, ITEMS[item].style) : trains.addWagon(h.q, h.r, h.y, ITEMS[item].train, ITEMS[item].style || '');
    if (err) toast(err);
    else {
      useHeld();
      playPlace('rail');
      // (succès : un wagon attelé ; un train de 11 wagons)
      if (ITEMS[item].train !== 'loco') { account.unlock('attelage'); if (trains.trains.some((t) => t.cars.length >= 12)) account.unlock('convoi'); }
    }
    return;
  }
  if (item === HEXACART) {
    // un Hexacart se pose sur un rail
    if (target && isRail(world.getBlock(target.hit.q, target.hit.r, target.hit.y))) {
      if (net.isClient) net.cartAction('spawn', { q: target.hit.q, r: target.hit.r, y: target.hit.y, yaw: player.yaw });
      else carts.spawn(target.hit.q, target.hit.r, target.hit.y, player.yaw);
      useHeld();
    } else {
      toast('Pose l\'Hexacart sur un rail');
    }
    return;
  }
  if (!target || !target.prev) return;
  // clic droit sur un rail de propulsion, un booster ou une torche d'énergie : l'allume ou l'éteint
  const aimed = world.getBlock(target.hit.q, target.hit.r, target.hit.y);
  // survie : clic droit sur une table de craft (Maj : poser un bloc dessus à la place)
  if (survival.on && aimed === CRAFTING_TABLE && !shift) { openCraft(3); return; }
  // clic droit sur un bloc de structure : sauvegarder / charger une structure (Maj : poser dessus)
  if (aimed === STRUCTURE_BLOCK && !shift) { openStructure(target.hit.q, target.hit.r, target.hit.y); return; }
  // clic droit sur un tapis roulant : y poser ce qu'on tient, ou reprendre ce qu'il porte
  if (isBelt(aimed) && !shift) { clickBelt(target.hit.q, target.hit.r, target.hit.y); return; }
  // clic droit sur un entonnoir, un extracteur, un bras : l'objet tenu devient son filtre (main
  // vide : plus de filtre) ; sur un assembleur, l'objet tenu est ce qu'il fabrique (Maj : poser un bloc)
  if ((BLOCKS[aimed]?.filter || BLOCKS[aimed]?.assembler) && !shift && net.isClient && (BLOCKS[aimed].filter || (item && industry.recipeFor(item)))) {
    net.csend({ t: 'indq', a: 'cfg', q: target.hit.q, r: target.hit.r, y: target.hit.y, i: item || 0 });
    return;
  }
  if ((BLOCKS[aimed]?.filter || BLOCKS[aimed]?.assembler) && !shift && !net.isClient) {
    const msg = industry.configure(target.hit.q, target.hit.r, target.hit.y, item || 0);
    if (msg) { toast(msg); playClick(); return; }
  }
  // soudure de joint : la case visée arrête l'air (voir doors.js)
  if (item === WELDER) {
    if (net.isClient) { toast("La soudure de joint se fait chez l'hôte de la partie"); return; }
    const { q, r, y } = target.hit;
    toast(orbital.weld(q + ',' + r + ',' + y) ? "Joint soudé : ce bloc arrête l'air" : 'Soudure retirée');
    playClick();
    return;
  }
  // clic droit avec un bidon sur un tuyau ou un réservoir : le remplir de carburant, ou le vider
  if ((item === CANISTER || item === FUEL_CANISTER || item === CREATIVE_CANISTER || LIQUID_OF_CAN[item]) && BLOCKS[aimed]?.fluid && !shift) {
    if (net.isClient) { toast("Les bidons se remplissent chez l'hôte de la partie"); return; }
    const res = industry.canister(target.hit.q, target.hit.r, target.hit.y, item);
    if (res) {
      toast(res.msg);
      if (res.give && survival.on) { survival.take(slot, 1); if (survival.give(res.give, 1)) toast('Inventaire plein'); }
      playClick();
      return;
    }
  }
  // clic droit sur un coffre ou un four : on l'ouvre (Maj : poser un bloc dessus)
  if (BLOCKS[aimed]?.container && !shift) { openBox(target.hit.q, target.hit.r, target.hit.y); return; }
  // clic droit sur un lit de villageois : on s'y couche (la nuit)
  if (isPod(aimed) && !shift) { sleepInPod(target.hit.q, target.hit.r, target.hit.y); return; }
  // clic droit sur une gare : son nom (Maj : poser un bloc dessus)
  if (isStation(aimed) && !shift) { openStation(target.hit.q, target.hit.r, target.hit.y); return; }
  // clic droit sur un panneau de limitation : la vitesse suivante
  if (BLOCKS[aimed]?.prop === 'sign' && !shift) {
    const { q, r, y } = target.hit, k = q + ',' + r + ',' + y;
    if (net.isClient) { net.csend({ t: 'tr', a: 'limit', q, r, y }); const p = tracks.propAt(q, r, y), L = [20, 40, 60, 80, 100, 120, 160, 200, 0]; if (p) toast(`Limitation : ${(v => (v ? v + ' km/h' : 'fin de limitation'))(L[(L.indexOf(p.kmh) + 1) % L.length])}`); }
    else { const v = tracks.nextLimit(k); toast(`Limitation : ${v ? v + ' km/h' : 'fin de limitation'}`); }
    playClick();
    return;
  }
  // clic droit sur une TNT avec une torche en main : on l'allume
  if (isTnt(aimed) && (item === TORCH || item === ENERGY_TORCH)) {
    const { q, r, y } = target.hit;
    if (aimed === 78 && survival.on) account.unlock('demolition'); // (TNT 1000, en survie : elle se mérite)
    if (net.isClient) net.csend({ t: 'ignite', q, r, y });
    else tnt.ignite(q, r, y, undefined, listener);
    return;
  }
  if ((BLOCKS[aimed]?.door === 'seal' || BLOCKS[aimed]?.door === 'airlock') && !shift) {
    toggleDoor((a, b, c) => world.getBlock(a, b, c), (a, b, c, v) => world.setBlock(a, b, c, v), target.hit.q, target.hit.r, target.hit.y);
    return;
  }
  if (TOGGLE[aimed]) {
    world.setBlock(target.hit.q, target.hit.r, target.hit.y, TOGGLE[aimed]);
    return;
  }
  if (isAnalog(aimed)) {
    const v = analogStep(aimed, shift);
    if (v !== aimed) world.setBlock(target.hit.q, target.hit.r, target.hit.y, v);
    return;
  }
  // houe : clic droit sur le dessus d'herbe ou de terre (de l'air au-dessus) : terre labourée
  if (ITEMS[item]?.tool === 'hoe') {
    const { q, r, y } = target.hit;
    if (target.prev.y === y + 1 && [1, 2, 36].includes(aimed) && !SOLID[world.getBlock(q, r, y + 1)]) {
      // (une herbe haute ou une pousse au-dessus est arrachée)
      if (world.getBlock(q, r, y + 1) !== AIR) world.setBlock(q, r, y + 1, AIR);
      if (world.setBlock(q, r, y, FARMLAND)) { playStep('herbe'); hand.punch(); if (survival.on) wearHeld(1); }
    }
    return;
  }
  if (!block || !BLOCKS[block]) return;
  // dalle : se complète en bloc plein si on vise la moitié vide d'une dalle de même matière
  if (SLAB[block]) {
    const fill = slabToFill(block);
    if (fill) {
      if (player.occupies(fill.q, fill.r, fill.y) || net.occupies(fill.q, fill.r, fill.y)) return;
      if (world.setBlock(fill.q, fill.r, fill.y, fill.id)) { useHeld(); updateTarget(); }
      return;
    }
  }
  // couche de neige : une de plus sur la couche visée (8 au plus), sinon une nouvelle sur le
  // dessus d'un bloc ; un autre bloc posé sur une couche de neige la remplace
  if (block === SNOW_LAYER) {
    for (const c of [target.hit, target.prev]) {
      const id = world.getBlock(c.q, c.r, c.y);
      if (isSnowLayer(id) && id < SNOW_LAYER + 7) { if (world.setBlock(c.q, c.r, c.y, id + 1)) { useHeld(); updateTarget(); playPlace('snow'); } return; }
    }
    const p = target.prev;
    if (world.getBlock(p.q, p.r, p.y) !== AIR || !holdsSnow(world.getBlock(p.q, p.r, p.y - 1))) { toast("La neige se pose sur le dessus d'un bloc"); return; }
    if (world.setBlock(p.q, p.r, p.y, SNOW_LAYER)) { useHeld(); updateTarget(); playPlace('snow'); }
    return;
  }
  const { q, r, y } = isSnowLayer(aimed) ? target.hit : target.prev;
  let here = world.getBlock(q, r, y);
  if (isSnowLayer(here)) here = AIR; // (la neige est remplacée)
  // (une dalle verticale n'occupe que la moitié de la case : on peut la poser à côté de soi)
  const half = SLAB[block] === 3 ? slabHalf(block) : 0;
  if ((here !== AIR && !isWater(here) && !BLOCKS[here]?.lava) || player.occupies(q, r, y, half) || net.occupies(q, r, y)) return;
  // torche visée sur le côté d'un bloc : torche murale, accrochée à ce bloc
  if (block === TORCH && y === target.hit.y && here === AIR) {
    const k = NEIGHBORS.findIndex(([a, b]) => q + a === target.hit.q && r + b === target.hit.r);
    if (k >= 0 && SUPPORT[world.getBlock(target.hit.q, target.hit.r, y)]) {
      if (world.setBlock(q, r, y, WALL_TORCH + k)) { useHeld(); updateTarget(); tutoPlaced(q, r, y); placedFx(q, r, y); }
      return;
    }
  }
  // un rail ou une torche se pose sur un bloc plein (ou une dalle haute), hors de l'eau
  if (ATTACHED[block] && (here !== AIR || !SUPPORT[world.getBlock(q, r, y - 1)])) return;
  // une pousse ne prend que sur l'herbe ou la terre
  // (le blé se sème sur la terre labourée)
  if (BLOCKS[block].crop !== undefined) {
    if (!isFarmland(world.getBlock(q, r, y - 1))) { toast('Sème les graines sur de la terre labourée (une houe, clic droit sur la terre)'); return; }
  } else if (BLOCKS[block].sapling && ![1, 2, 36].includes(world.getBlock(q, r, y - 1))) { toast("Plante-la sur de l'herbe ou de la terre"); return; }
  // (placedAs : les feuilles posées par le joueur ne disparaissent jamais)
  // piston : posé sous un bloc, il pousse vers le bas ; sinon vers le haut
  let placed = BLOCKS[block].placedAs ?? block;
  if (BLOCKS[block].piston) placed = BLOCKS[block].pBase + (target.prev.y < target.hit.y ? 3 : 0);
  // porte étanche : deux blocs de haut (le haut vient avec le bas)
  if (block === SEAL_DOOR) {
    if (world.getBlock(q, r, y + 1) !== AIR) { toast('Pas assez de place : la porte étanche fait deux blocs de haut'); return; }
    if (world.setBlock(q, r, y, SEAL_DOOR)) { world.setBlock(q, r, y + 1, SEAL_DOOR_TOP); useHeld(); updateTarget(); placedFx(q, r, y); }
    return;
  }
  // lit de villageois : deux blocs de haut, l'ouverture tournée vers le joueur
  if (BLOCKS[block].pod !== undefined) {
    if (world.getBlock(q, r, y + 1) !== AIR) { toast('Pas assez de place : le lit fait deux blocs de haut'); return; }
    const k = sideToward(q, r);
    if (world.setBlock(q, r, y, POD + k)) { world.setBlock(q, r, y + 1, POD_TOP + k); useHeld(); updateTarget(); placedFx(q, r, y); }
    return;
  }
  if (world.setBlock(q, r, y, SLAB[block] ? slabHalf(block) : facingVariant(placed, sideToward(q, r)))) {
    useHeld(); updateTarget(); tutoPlaced(q, r, y); placedFx(q, r, y);
    // (une pousse plantée par le joueur : le forestier des villages n'y touchera pas)
    if (BLOCKS[placed]?.sapling && BLOCKS[placed].crop === undefined) animals.colony.markPlanted(q, r, y);
  }
}
// ---------- Schématiques (voir schematics.js) ----------
const PLACED_BY = new Map(Object.entries(ITEMS).filter(([, it]) => it.places).map(([k, it]) => [it.places, +k]));
// Clic gauche : retirer la projection visée (3 clics rapides sans la schématique), sinon (la
// schématique en main) le premier coin de la zone. true : le clic est pris
function schemLeft() {
  const holding = hotbar[slot] === SCHEMATIC;
  const g = schem.ghostAt(eye, lookDir, Math.min(REACH, target ? target.t : REACH));
  if (g) {
    if (holding || schem.tripleClick(g.p)) { schem.remove(g.p); world.changed = true; toast(`Projection « ${g.p.name} » retirée`); }
    else if (schem.clicks?.n === 1) toast('Encore 2 clics rapides pour retirer cette projection');
    return true;
  }
  if (!holding) return false;
  if (target) { schem.setCorner(0, target.hit); toast('Premier coin de la zone : clic droit sur un autre bloc pour le deuxième'); }
  return true;
}
function schemRight(shift) {
  if (shift) { openSchem(); return; }
  const g = schem.ghostAt(eye, lookDir, Math.min(REACH, target ? target.t : REACH));
  if (g) { fillGhosts(g.p); return; }
  if (schem.plan !== null) {
    if (!target?.prev) return;
    const { q, r, y } = target.prev, p = schem.place(q, r, y);
    if (p) { world.changed = true; toast(`Plan « ${p.name} » projeté : clic droit sur un fantôme pour le construire, clic gauche pour le retirer`); }
    return;
  }
  if (!target) return;
  schem.setCorner(1, target.hit);
  const b = schem.selBounds();
  toast(b ? `Zone de ${b.hi[0] - b.lo[0] + 1} × ${b.hi[1] - b.lo[1] + 1} cases, ${b.hi[2] - b.lo[2] + 1} de haut : Maj + clic droit pour l'enregistrer` : 'Deuxième coin : clic gauche sur un autre bloc pour le premier');
}
// Construit la projection avec les blocs de l'inventaire (créatif : sans rien prendre)
function fillGhosts(p) {
  if (net.isClient) { toast('En ligne, seul l\'hôte peut construire une projection d\'un coup (pose les blocs à la main)'); return; }
  const take = (id) => {
    if (!survival.on) return true;
    const want = BLOCKS[id]?.pick ?? PLACED_BY.get(id) ?? id;
    const i = survival.slots.findIndex((s) => s && s.id === want);
    if (i < 0) return false;
    survival.take(i);
    return true;
  };
  const res = schem.fill(p, take, (q, r, y) => player.occupies(q, r, y) || net.occupies(q, r, y));
  if (res.done) { world.changed = true; playPlace(); }
  if (!res.left) { toast(`« ${p.name} » est construit ✓`); schem.remove(p); return; }
  const need = [...res.need].slice(0, 3).map(([id, n]) => `${n} × ${itemName(BLOCKS[id]?.pick ?? PLACED_BY.get(id) ?? id)}`).join(', ');
  toast(`${res.done} blocs posés — il en manque ${res.left}${need ? ' (' + need + (res.need.size > 3 ? '…' : '') + ')' : ' (une case occupée ?)'}`);
}
const schemList = document.getElementById('schem-list'), schemName = document.getElementById('schem-name');
function openSchem() {
  physTarget = { schem: true, struct: targetStruct?.struct || null };
  state = 'phys';
  keys.clear();
  mouse.left = mouse.right = false;
  schemName.value = '';
  renderSchem();
  show('schem');
  document.exitPointerLock();
  setTimeout(() => schemName.focus(), 0);
}
function renderSchem() {
  const b = schem.selBounds(), plan = schem.lib[schem.plan];
  document.getElementById('schem-hint').textContent = (b
    ? `Zone choisie : ${b.hi[0] - b.lo[0] + 1} × ${b.hi[1] - b.lo[1] + 1} cases, ${b.hi[2] - b.lo[2] + 1} de haut.`
    : 'Pas de zone : la schématique en main, clic gauche puis clic droit sur deux blocs pour en choisir les coins.')
    + (plan ? ` Plan en main : « ${plan.name} »${schem.rot ? ` (tourné de ${schem.rot * 60}°)` : ''}.` : '');
  document.getElementById('schem-save-obj').disabled = !physTarget?.struct;
  schemList.innerHTML = '';
  if (!schem.lib.length) schemList.innerHTML = '<p class="empty">Aucun plan enregistré pour l\'instant.</p>';
  schem.lib.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'schem-row' + (i === schem.plan ? ' on' : '');
    const t = document.createElement('b');
    t.textContent = p.name;
    const n = document.createElement('small');
    n.textContent = `${p.b.length} bloc${p.b.length > 1 ? 's' : ''}`;
    const pick = document.createElement('button');
    pick.textContent = 'Choisir';
    pick.addEventListener('click', () => { schem.choose(i); closePhys(false); toast(`Plan « ${p.name} » : clic droit pour le projeter`); });
    const del = document.createElement('button');
    del.textContent = 'Supprimer';
    del.addEventListener('click', async () => {
      if (!(await ask(`Supprimer le plan « ${p.name} » ?`, 'Supprimer'))) return;
      schem.deletePlan(i);
      renderSchem();
    });
    row.append(t, n, pick, del);
    schemList.appendChild(row);
  });
}
const schemSave = (blocks) => {
  const name = schemName.value.trim().slice(0, 32) || 'Plan ' + (schem.lib.length + 1);
  const err = schem.addPlan(name, blocks);
  toast(err || `Plan « ${name} » enregistré (${blocks.length} blocs)`);
  if (!err) schemName.value = '';
  renderSchem();
};
document.getElementById('schem-save-sel').addEventListener('click', () => {
  const r = schem.selBlocks();
  if (r.err) toast(r.err); else schemSave(r.blocks);
});
document.getElementById('schem-save-obj').addEventListener('click', () => {
  const s = physTarget?.struct;
  if (s && structs.list.includes(s)) schemSave(s.list.map((e) => [...e])); else toast('Vise un objet collé avant d\'ouvrir le menu');
});
document.getElementById('schem-rot').addEventListener('click', () => {
  if (schem.plan === null) { toast('Choisis d\'abord un plan'); return; }
  schem.rotate();
  renderSchem();
});
document.getElementById('schem-none').addEventListener('click', () => { schem.choose(null); renderSchem(); });
document.getElementById('schem-clear').addEventListener('click', () => { schem.clearSel(); renderSchem(); });
document.getElementById('schem-close').addEventListener('click', () => closePhys(false));
schemName.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('schem-save-sel').click();
});

// ---------- Voltite sans fil ----------
// Clic droit sur un émetteur / récepteur : l'objet en main devient sa fréquence (main vide : on la voit)
function radioClick(item) {
  const { q, r, y } = target.hit;
  if (net.isClient) { toast('En ligne, seul l\'hôte peut régler les fréquences'); return; }
  if (!item) {
    const f = circuits.radio.get(q + ',' + r + ',' + y) || 0;
    toast(f ? `Fréquence : ${itemName(f)}` : 'Pas de fréquence : clic droit dessus avec un objet en main pour la choisir');
    return;
  }
  circuits.setFreq(q, r, y, item);
  world.changed = true;
  toast(`Fréquence : ${itemName(item)} (accroupi + clic droit : poser un bloc contre lui)`);
}

// ---------- Voies du train (voir tracks.js) ----------
// Clic droit avec un rail de train : sur le sol, pose un rail dans l'axe du regard ; sur un rail,
// prolonge la ligne droite devant lui (du côté du regard). Accroupi + clic droit sur un rail :
// choisit le départ d'un virage, puis un clic droit là où la voie doit arriver pose le virage.
// Accroupi + clic droit pendant un virage commencé : l'annule.
let curveStart = null;
function trackClick(shift) {
  // (un départ au-dessus du monde est gardé : on peut aller jusqu'à un autre astre pour poser l'arrivée)
  if (curveStart && (shift || (performance.now() - curveStart.t > 90000 && !(tracks.nodes.get(curveStart.key)?.y >= H)))) { curveStart = null; toast('Virage annulé'); return; }
  if (curveStart && performance.now() - curveStart.t < 250) return; // (clic maintenu : pas deux fois de suite)
  if (!target) return;
  tracks.update();
  const h = target.hit, hitId = world.getBlock(h.q, h.r, h.y), here = isTrack(hitId) ? tracks.nodes.get(h.q + ',' + h.r + ',' + h.y) : null;
  const lx = lookDir.x, lz = lookDir.z;
  if (curveStart) {
    // la fin du virage : sur un rail existant, ou une nouvelle case (posée dans l'axe du regard)
    const a = tracks.nodes.get(curveStart.key);
    if (!a || tracks.full(a, curveStart.side)) { curveStart = null; toast('Le départ du virage a changé : recommence'); return; }
    let q, r, y, axis;
    if (here) ({ q, r, y, axis } = here);
    else {
      if (!target.prev) return;
      ({ q, r, y } = target.prev);
      const id = world.getBlock(q, r, y);
      if ((id !== AIR && !isWater(id)) || player.occupies(q, r, y) || net.occupies(q, r, y)) return;
      axis = axisOf(lx, lz).axis;
    }
    if (here === a) return;
    // (deux bouts de voie sur deux astres, au-dessus du monde : une ligne spatiale)
    if (here && zoneOfXZ(here.pos.x, here.pos.z) !== zoneOfXZ(a.pos.x, a.pos.z)) {
      if (a.y < H || here.y < H) { toast(`Une ligne entre deux astres passe au-dessus du monde (hauteur ${H} au moins)`); return; }
      if (zoneOfXZ(here.pos.x, here.pos.z) < 0 || zoneOfXZ(a.pos.x, a.pos.z) < 0) { toast('Une ligne spatiale va d\'un astre à un autre'); return; }
      const bs0 = (a.pos.x - here.pos.x) * Math.cos(here.axis * Math.PI / 3) + (a.pos.z - here.pos.z) * Math.sin(here.axis * Math.PI / 3) >= 0 ? 1 : -1;
      if (!tracks.room(here, bs0, true) || !tracks.room(a, curveStart.side, true)) { toast('Ce rail a déjà une voie droite de ce côté'); return; }
      if (survival.on && (survival.slots[slot]?.n || 0) < 64) { toast('Il faut 64 rails de train pour une ligne spatiale'); return; }
      if (net.isClient) net.csend({ t: 'tr', a: 'xlink', k: a.key, as: curveStart.side, k2: here.key, bs: bs0 });
      else tracks.addLine(a, curveStart.side, here.key, bs0);
      if (survival.on) survival.take(slot, 64);
      curveStart = null;
      playPlace('rail');
      toast('Ligne spatiale posée');
      return;
    }
    const c = hexToWorld(q, r);
    const bs = (a.pos.x - c.x) * Math.cos(axis * Math.PI / 3) + (a.pos.z - c.z) * Math.sin(axis * Math.PI / 3) >= 0 ? 1 : -1;
    if (here && !tracks.room(here, bs, false)) { toast('Ce rail a déjà deux sorties de ce côté'); return; }
    const res = tracks.check(a, curveStart.side, q, r, y, axis, bs);
    if (typeof res === 'string') { toast(res); return; }
    // (en survie : un rail de train pour 2 cases de virage)
    const cost = Math.ceil(res.len / 2);
    if (survival.on && (survival.slots[slot]?.n || 0) < cost) { toast(`Il faut ${cost} rails de train pour ce virage`); return; }
    if (!here) world.setBlock(q, r, y, TRACK_IDS[axis]);
    if (net.isClient) net.csend({ t: 'tr', a: 'curve', k: a.key, as: curveStart.side, q, r, y, axis, bs });
    else tracks.addCurve(a, curveStart.side, q + ',' + r + ',' + y, bs);
    if (survival.on) survival.take(slot, cost);
    curveStart = null;
    playPlace('rail');
    toast(`Virage posé (${Math.round(res.len)} cases)`);
    if (res.len >= 48) account.unlock('grand_virage');
    return;
  }
  if (here && !shift && tracks.isSwitch(here)) { toggleSwitch(here); return; }
  if (here && !shift) {
    // prolonger la ligne : un rail dans la case suivante, du côté du regard (même axe)
    const side = lx * Math.cos(here.axis * Math.PI / 3) + lz * Math.sin(here.axis * Math.PI / 3) >= 0 ? 1 : -1;
    const [dq, dr] = NEIGHBORS[here.axis];
    const q = here.q + dq * side, r = here.r + dr * side, y = here.y, id = world.getBlock(q, r, y);
    if ((id !== AIR && !isWater(id)) || player.occupies(q, r, y) || net.occupies(q, r, y)) return;
    if (world.setBlock(q, r, y, TRACK_IDS[here.axis])) { useHeld(); updateTarget(); placedFx(q, r, y); }
    return;
  }
  if (here) {
    // le départ d'un virage : le côté du rail le plus proche du regard (s'il a déjà une sortie de
    // ce côté, le virage en fait un aiguillage) ; sinon l'autre côté
    let side = lx * Math.cos(here.axis * Math.PI / 3) + lz * Math.sin(here.axis * Math.PI / 3) >= 0 ? 1 : -1;
    if (!tracks.room(here, side, false)) side = -side;
    if (!tracks.room(here, side, false)) { toast('Ce rail a déjà deux sorties de chaque côté'); return; }
    curveStart = { key: here.key, side, t: performance.now() };
    fx.sparkle(here.pos.x, here.pos.y, here.pos.z);
    toast("Départ du virage choisi : clic droit là où la voie doit arriver (accroupi + clic droit : annuler)");
    return;
  }
  // un rail simple, dans l'axe du regard
  if (!target.prev) return;
  const { q, r, y } = target.prev, id = world.getBlock(q, r, y);
  if ((id !== AIR && !isWater(id)) || player.occupies(q, r, y) || net.occupies(q, r, y)) return;
  if (world.setBlock(q, r, y, TRACK_IDS[axisOf(lx, lz).axis])) { useHeld(); updateTarget(); placedFx(q, r, y); }
}
// Aiguillage : bascule entre le tout droit et la branche (le panneau à côté change de couleur)
function toggleSwitch(n) {
  // (invité : l'hôte bascule l'aiguillage et renvoie les voies à tous)
  if (net.isClient) {
    if (!tracks.isSwitch(n)) return false;
    net.csend({ t: 'tr', a: 'switch', k: n.key });
    playClick();
    playStep('metal', 0.8);
    return true;
  }
  const w = tracks.toggle(n);
  if (!w) return false;
  playClick();
  playStep('metal', 0.8);
  toast(`Aiguillage : ${w}`);
  account.unlock('aiguilleur');
  return true;
}
// (un bloc posé : son bruit et un peu de poussière)
function placedFx(q, r, y) {
  const id = world.getBlock(q, r, y), c = hexToWorld(q, r);
  if (isStation(id)) { account.unlock('chef_gare'); tracks.update(); if (tracks.stations.length >= 10) account.unlock('reseau'); }
  playPlace(matterOf(id));
  fx.place(c.x, y, c.z, id);
}
// (le tutoriel suit ce qu'on pose : table, four, torches)
function tutoPlaced(q, r, y) {
  progress.event('place', world.getBlock(q, r, y));
  if (!tutorial.on) return;
  const w = hexToWorld(q, r);
  tutorial.event('place', world.getBlock(q, r, y), w.x, w.z);
}

// Clic sur un bouton des menus : un petit bruit
addEventListener('click', (e) => { if (e.target.closest?.('button, .tab, [data-go]')) playClick(); }, true);

// ---------- Cartons : jeter, ramasser (voir cartons.js) ----------
const INV_HOLD = 450;   // (ms) touche de l'inventaire maintenue : collecte automatique
// touche Jeter maintenue : un carton de plus toutes les DROP_EVERY ms, après DROP_DELAY
const DROP_DELAY = 350, DROP_EVERY = 110;
let dropNext = 0;
let invKeyDown = 0;     // (moment où elle a été enfoncée ; -1 : déjà utilisée)
let autoCollect = false;
const autoEl = document.getElementById('autocollect');
function setAutoCollect(on, quiet = false) {
  autoCollect = on;
  autoEl.hidden = !on;
  if (!quiet) toast(on ? 'Collecte automatique activée : les cartons proches viennent à toi' : 'Collecte automatique désactivée');
}
// Message court au-dessus de la barre (comme le nom de l'objet choisi)
function showHint(text) {
  blockNameEl.textContent = text;
  blockNameEl.classList.add('show');
  clearTimeout(nameTimer);
  nameTimer = setTimeout(() => blockNameEl.classList.remove('show'), 1800);
}
function cartonText(c) {
  const n = countOf(c.items);
  const what = c.items.length === 1 ? itemName(c.items[0].id) : `${c.items.length} sortes d'objets`;
  return `Carton : ${n} × ${what} — ${Controls.actionKey('inventory')} : ramasser`;
}
// Un carton dans le monde (en ligne, un invité le demande à l'hôte, qui le crée et le montre à tous)
function spawnCarton(pos, items, vel = null, delay = 0) {
  if (!net.isClient) return cartons.spawn(pos, items, vel, delay);
  const v = vel || new THREE.Vector3();
  net.csend({ t: 'ctnspawn', x: pos.x, y: pos.y, z: pos.z, vx: v.x, vy: v.y, vz: v.z, d: delay ? 1 : 0, items });
  return null;
}
// Levier, torche, rail, fil... dont on a cassé le support : il tombe dans un carton, là où il était
// (en survie ; chez l'hôte ou en solo, les invités le reçoivent). Avant, il disparaissait
world.onPop = (q, r, y, id) => {
  if (!survival.on || net.isClient || state === 'menu' || !BLOCKS[id] || BLOCKS[id].unbreakable) return;
  const drop = BLOCKS[id].grass ? null : dropOf(id, 0);
  if (!drop) return;
  const c = hexToWorld(q, r);
  spawnCarton(new THREE.Vector3(c.x, y + 0.2, c.z), [{ id: drop[0], n: drop[1] }], null, 1.5);
};
// (invité, collecte automatique : on demande le carton à l'hôte)
cartons.onTake = (c) => { if (net.isClient && survival.on) net.csend({ t: 'ctntake', id: c.id }); };
// Met le contenu dans l'inventaire ; renvoie ce qui ne rentre pas
function grabCarton(c) {
  if (!survival.on) return [];
  const left = [];
  for (const s of c.items) { const r = survival.give(s.id, s.n, s.w || 0); if (r) left.push({ ...s, n: r }); }
  playStep('bois', 0.5);
  if (left.length < c.items.length) playPickup();
  if (left.length) toast('Inventaire plein');
  return left;
}
function pickCarton(c) {
  hand.punch();
  // (invité : l'hôte retire le carton et nous envoie son contenu)
  if (net.isClient) { if (survival.on) net.csend({ t: 'ctntake', id: c.id }); targetCarton = null; return; }
  const left = grabCarton(c);
  if (!left.length) cartons.remove(c);
  else { c.items = left; cartons.refresh(c); }
  targetCarton = null;
  updateTarget();
}
// Jeter l'objet tenu (all : toute la pile). En créatif, on jette une copie.
function dropHeld(all) {
  const id = hotbar[slot];
  if (!id) return;
  let items;
  if (survival.on) {
    const s = survival.slots[slot];
    if (!s) return;
    const n = all ? s.n : 1;
    items = [{ id: s.id, n, w: s.w }];
    survival.take(slot, n);
  } else items = [{ id, n: all ? stackMax(id) : 1 }];
  throwCarton(items);
}
function throwCarton(items) {
  updateLook();
  const from = eye.clone().addScaledVector(lookDir, 0.5);
  from.y -= 0.35;
  const vel = lookDir.clone().multiplyScalar(5.5).add(new THREE.Vector3(player.vel.x * 0.6, 2.2, player.vel.z * 0.6));
  spawnCarton(from, items, vel, 1.5);
  hand.punch();
}
// Inventaire ouvert : un clic hors de la fenêtre avec un objet tenu le jette
document.getElementById('scr-craft').addEventListener('mousedown', (e) => {
  if (e.target !== e.currentTarget || !survival.cursor) return;
  const c = survival.cursor;
  const n = e.button === 2 ? 1 : c.n;
  throwCarton([{ id: c.id, n, w: c.w }]);
  c.n -= n;
  if (c.n <= 0) survival.cursor = null;
  survival.changed();
});

// ---------- Clé à molette ----------
// Clic droit sur un bloc physique (dans le monde ou sur un objet collé) : réglage de la
// direction et de la vitesse (x, y, z en blocs par seconde) quand il reçoit du courant.
let physTarget = null; // { struct, key } ou { key } (dans le monde)
const physInputs = ['x', 'y', 'z'].map((a) => document.getElementById('phys-' + a));
function wrenchClick() {
  let params;
  if (targetStruct && !(target && target.t < targetStruct.t)) {
    const { struct: s, hit } = targetStruct, k = hit.q + ',' + hit.r + ',' + hit.y;
    if (s.blocks.get(k) === GRAVITRON) { openGrav({ struct: s, key: k }, s.params.get(k)); return; }
    if (isRoutePilot(s.blocks.get(k))) { openGrav({ struct: s, key: k, car: true }, s.params.get(k)); return; }
    if (BLOCKS[s.blocks.get(k)]?.turret) {
      // (l'équipe de tout l'engin)
      if (net.isClient) { toast("Seul l'hôte choisit les équipes"); return; }
      const t = weapons.nextTeam(weapons.teamOfStruct(s));
      weapons.setStructTeam(s, t);
      world.changed = true;
      playClick();
      const tac = { chase: 'chasser', flee: 'fuir', guard: 'garder' }[weapons.tactics.get(s.id)];
      toast(t ? `Équipe de l'engin : ${teamOf(t).name} (clé à molette : changer)` + (s.car ? (tac ? ` · stratégie : ${tac}` : ' · stratégie : clé à molette sur son pilote de route') : '') : "Engin sans équipe : ses tourelles ne tirent plus");
      return;
    }
    if (!isPhysics(s.blocks.get(k))) { toast('Vise un bloc physique, un gravitron ou un bloc cible'); return; }
    physTarget = { struct: s, key: k };
    params = s.params.get(k);
  } else if (target && world.getBlock(target.hit.q, target.hit.r, target.hit.y) === TARGET) {
    openTarget(target.hit.q + ',' + target.hit.r + ',' + target.hit.y);
    return;
  } else if (target && BLOCKS[world.getBlock(target.hit.q, target.hit.r, target.hit.y)]?.turret) {
    const k = target.hit.q + ',' + target.hit.r + ',' + target.hit.y;
    if (net.isClient) { toast("Seul l'hôte choisit les équipes"); return; }
    if (!weapons.worldTurrets.has(k)) weapons.onWorldSet(target.hit.q, target.hit.r, target.hit.y, world.getBlock(target.hit.q, target.hit.r, target.hit.y));
    const t = weapons.nextTeam(weapons.worldTeam(k));
    weapons.setWorldTeam(k, t);
    world.changed = true;
    playClick();
    toast(t ? `Équipe de la tourelle : ${teamOf(t).name} (clé à molette : changer)` : 'Tourelle sans équipe : elle ne tire plus');
    return;
  } else if (target && (world.getBlock(target.hit.q, target.hit.r, target.hit.y) === GRAVITRON || isRoutePilot(world.getBlock(target.hit.q, target.hit.r, target.hit.y)))) {
    const k = target.hit.q + ',' + target.hit.r + ',' + target.hit.y;
    openGrav({ key: k, car: isRoutePilot(world.getBlock(target.hit.q, target.hit.r, target.hit.y)) }, structs.worldParams.get(k));
    return;
  } else if (target && isPhysics(world.getBlock(target.hit.q, target.hit.r, target.hit.y))) {
    const k = target.hit.q + ',' + target.hit.r + ',' + target.hit.y;
    physTarget = { key: k };
    params = structs.worldParams.get(k);
  } else { toast('Vise un bloc physique, un gravitron ou un bloc cible'); return; }
  (params || PHYS_DEFAULT).forEach((v, i) => { physInputs[i].value = v; });
  state = 'phys';
  keys.clear();
  mouse.left = mouse.right = false;
  show('phys');
  document.exitPointerLock();
  setTimeout(() => physInputs[0].select(), 0);
}
// Gravitron : mode et coordonnées visées (celles de F3)
const gravInputs = ['x', 'y', 'z'].map((a) => document.getElementById('grav-' + a));
const GRAV_NAMES = ['missile', 'avion', 'bateau', 'voiture'];
function openGrav(t, params) {
  physTarget = { ...t, grav: true };
  const p = params || [Math.round(player.pos.x), Math.round(player.pos.y), Math.round(player.pos.z), t.car ? 3 : 1];
  // (pilote de route : le même écran, sans le choix du mode ; il conduit toujours sur ses roues)
  document.querySelector('#scr-grav .grav-modes').hidden = !!t.car;
  document.getElementById('grav-title').textContent = t.car ? 'Pilote de route' : 'Gravitron';
  document.getElementById('grav-hint').textContent = t.car
    ? "Conduit la voiture sur ses roues jusqu'à ces coordonnées, ou d'étape en étape (Parcours). Ses roues doivent recevoir du courant ; l'avant de la voiture : celui du volant, sinon le sien."
    : "Pilote les blocs physiques allumés de l'objet jusqu'à ces coordonnées (celles de F3). Leurs vitesses s'additionnent (30 blocs/s au plus).";
  gravInputs.forEach((el, i) => { el.value = p[i]; });
  const mode = document.querySelector('input[name="grav-mode"][value="' + (p[3] | 0) + '"]');
  if (mode) mode.checked = true;
  fillGravTargets(p);
  // (stratégie : seulement une voiture déjà collée, chez l'hôte)
  const tacRow = document.getElementById('grav-tactic-row');
  // (un engin sur roues collé : pilote de route, ou gravitron en mode Voiture)
  tacRow.hidden = !(t.struct?.car && !net.isClient);
  document.getElementById('grav-tactic').value = (t.struct && weapons.tactics.get(t.struct.id)) || '';
  // parcours déjà réglé : ses étapes (bloc cible retrouvé par sa position)
  gravStops = [];
  gravLoop.checked = false;
  if (p.length >= 6) {
    const { route, loop } = gravRoute(p);
    gravStops = route.map((w) => ({ k: targetAt([w.x, w.y, w.z]), pos: [w.x, w.y, w.z], wait: w.wait }));
    gravLoop.checked = loop;
  }
  showGravRoute(false);
  state = 'phys';
  keys.clear();
  mouse.left = mouse.right = false;
  show('grav');
  document.exitPointerLock();
  setTimeout(() => gravInputs[0].select(), 0);
}
document.getElementById('grav-here').addEventListener('click', () => {
  [player.pos.x, player.pos.y, player.pos.z].forEach((v, i) => { gravInputs[i].value = Math.round(v); });
  gravTarget.value = '';
});
// Liste des blocs cibles du monde (les plus proches d'abord) : en choisir un remplit les coordonnées
const gravTarget = document.getElementById('grav-target');
function targetList() {
  return [...targetNames].map(([k, name]) => {
    const t = targetPos(k);
    return { k, name, t, d: Math.hypot(t[0] - player.pos.x, t[2] - player.pos.z) };
  }).sort((a, b) => a.d - b.d);
}
// Bloc cible dont la position (au-dessus du bloc) est p, ou null
function targetAt(p) {
  for (const k of targetNames.keys()) if (targetPos(k).every((v, i) => v === Math.round(p[i]))) return k;
  return null;
}
function fillGravTargets(p) {
  const list = targetList();
  gravTarget.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = list.length ? 'Coordonnées ci-dessous' : 'Aucun bloc cible dans le monde';
  gravTarget.appendChild(none);
  for (const c of list) {
    const o = document.createElement('option');
    o.value = c.k;
    o.textContent = `${c.name}  (${Math.round(c.d)} blocs)`;
    gravTarget.appendChild(o);
  }
  gravTarget.value = list.find((c) => c.t.every((v, i) => v === Math.round(p[i])))?.k || '';
}
gravTarget.addEventListener('change', () => {
  if (gravTarget.value) targetPos(gravTarget.value).forEach((v, i) => { gravInputs[i].value = v; });
});
gravInputs.forEach((el) => el.addEventListener('input', () => { gravTarget.value = ''; }));
// ---------- Parcours (sous-menu) : les étapes { k : bloc cible (ou null), pos, wait } ----------
const gravMain = document.querySelector('#scr-grav > .inv:not(#grav-route)');
const gravRouteEl = document.getElementById('grav-route');
const gravRouteList = document.getElementById('grav-route-list');
const gravLoop = document.getElementById('grav-route-loop');
const gravRouteBtn = document.getElementById('grav-route-open');
let gravStops = [];
function showGravRoute(on) {
  gravMain.hidden = on;
  gravRouteEl.hidden = !on;
  if (on) renderGravRoute();
  gravRouteBtn.textContent = gravStops.length ? `Parcours (${gravStops.length} étape${gravStops.length > 1 ? 's' : ''})` : 'Parcours…';
}
function renderGravRoute() {
  const list = targetList();
  gravRouteList.innerHTML = '';
  if (!gravStops.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = list.length ? 'Aucune étape : ajoute des blocs cibles, dans l\'ordre du trajet.' : 'Il n\'y a aucun bloc cible dans le monde : pose-en d\'abord (et nomme-les à la clé à molette).';
    gravRouteList.appendChild(li);
  }
  gravStops.forEach((st, i) => {
    const li = document.createElement('li');
    const n = document.createElement('span');
    n.textContent = i + 1 + '.';
    const sel = document.createElement('select');
    if (!st.k) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = `Position ${st.pos.map(Math.round).join(' / ')}`;
      sel.appendChild(o);
    }
    for (const c of list) {
      const o = document.createElement('option');
      o.value = c.k;
      o.textContent = c.name;
      sel.appendChild(o);
    }
    sel.value = st.k || '';
    sel.addEventListener('change', () => { if (sel.value) { st.k = sel.value; st.pos = targetPos(sel.value); } });
    const wait = document.createElement('input');
    wait.type = 'number';
    wait.min = 0;
    wait.max = 3600;
    wait.step = 1;
    wait.value = st.wait;
    wait.title = 'Temps d\'arrêt (secondes)';
    wait.addEventListener('input', () => { st.wait = Math.max(0, Math.min(3600, Number(wait.value.replace(',', '.')) || 0)); });
    const btns = document.createElement('span');
    btns.className = 'route-btns';
    const btn = (label, title, fn) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', () => { fn(); renderGravRoute(); });
      btns.appendChild(b);
    };
    btn('↑', 'Monter', () => { if (i) [gravStops[i - 1], gravStops[i]] = [gravStops[i], gravStops[i - 1]]; });
    btn('↓', 'Descendre', () => { if (i < gravStops.length - 1) [gravStops[i + 1], gravStops[i]] = [gravStops[i], gravStops[i + 1]]; });
    btn('✕', 'Retirer', () => gravStops.splice(i, 1));
    const secs = document.createElement('label');
    secs.append(wait);
    li.append(n, sel, secs, btns);
    gravRouteList.appendChild(li);
  });
}
gravRouteBtn.addEventListener('click', () => showGravRoute(true));
document.getElementById('grav-route-back').addEventListener('click', () => showGravRoute(false));
document.getElementById('grav-route-clear').addEventListener('click', () => { gravStops = []; renderGravRoute(); });
document.getElementById('grav-route-add').addEventListener('click', () => {
  const list = targetList();
  if (!list.length) { renderGravRoute(); return; }
  if (gravStops.length >= ROUTE_MAX) { toast(`Un parcours a ${ROUTE_MAX} étapes au plus`); return; }
  // (par défaut : le plus proche pas encore dans le parcours, sinon un autre que la dernière étape)
  const last = gravStops[gravStops.length - 1];
  const c = list.find((c) => !gravStops.some((st) => st.k === c.k)) || list.find((c) => c.k !== last?.k) || list[0];
  gravStops.push({ k: c.k, pos: c.t, wait: last ? last.wait : 5 });
  renderGravRoute();
  gravRouteList.lastElementChild?.scrollIntoView({ block: 'nearest' });
});
// Bloc cible : son nom (clé à molette)
const TARGET_NAME_MAX = 32;
const targetInput = document.getElementById('target-name');
function openTarget(k) {
  addTarget(k);
  physTarget = { target: k };
  targetInput.value = targetNames.get(k);
  document.getElementById('target-title').textContent = 'Bloc cible';
  document.getElementById('target-hint').textContent = "Son nom, tel qu'il apparaît dans la liste des destinations du gravitron.";
  state = 'phys';
  keys.clear();
  mouse.left = mouse.right = false;
  show('target');
  document.exitPointerLock();
  setTimeout(() => targetInput.select(), 0);
}
// Gare : son nom (montré dans le train, sur l'écran de bord et sur la carte)
function openStation(q, r, y) {
  tracks.update();
  const st = tracks.stationAt(q, r, y);
  if (!st) return;
  physTarget = { station: st.key };
  targetInput.value = st.name || '';
  document.getElementById('target-title').textContent = 'Gare';
  document.getElementById('target-hint').textContent = 'Son nom, montré aux voyageurs (écran de bord du train, carte). Les trains en pilote automatique s\'arrêtent 10 secondes à chaque gare.';
  state = 'phys';
  keys.clear();
  mouse.left = mouse.right = false;
  show('target');
  document.exitPointerLock();
  setTimeout(() => targetInput.select(), 0);
}
// Combustible dans la locomotive (l'objet tenu, un à chaque clic)
function refuelLoco(c) {
  const id = hotbar[slot];
  if (net.isClient) { net.csend({ t: 'tr', a: 'fuel', id: c.id, item: id }); useHeld(); playPlace('stone'); return; }
  if (!trains.refuel(c, id, 1)) { toast('Le réservoir de la locomotive est plein'); return; }
  useHeld();
  playPlace('stone');
  toast(`Combustible : ${fuelText(c.fuel)}`);
  if (c.fuel >= trains.limits(c.train).tank - 1) account.unlock('plein');
}
// Pilote automatique (dans la cabine) : il garde la vitesse, s'arrête en gare, suit la voie
function toggleAutopilot(c) {
  if (net.isClient) { net.csend({ t: 'tr', a: 'auto', id: c.id }); playClick(); return; }
  const on = trains.setAuto(c);
  playClick();
  toast(on ? `Pilote automatique : ${Math.round(c.train.auto.v * 3.6)} km/h (Z / S : plus vite / moins vite ; S jusqu'à l'arrêt : coupé)` : 'Pilote automatique coupé');
}
// Écran de bord (à bord d'un train) : vitesse, pilote, combustible, prochaine gare, aiguillage,
// bout de la voie
const dashEl = Object.assign(document.createElement('div'), { id: 'train-dash' });
dashEl.hidden = true;
document.body.appendChild(dashEl);
let dashT = 0;
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const meters = (d) => (d >= 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(d) + ' m');
function updateDash(dt) {
  const c = player.riding?.isTrain ? player.riding : null;
  const on = !!c && state === 'playing';
  if (dashEl.hidden === on) dashEl.hidden = !on;
  if (!on || (dashT -= dt) > 0) return;
  dashT = 0.2;
  const d = trains.dash(c);
  if (!d) { dashEl.hidden = true; return; }
  const kmh = Math.round(Math.abs(d.v) * 3.6), max = Math.round(d.vmax * 3.6), driver = c.kind === 'loco' || c.kind === 'tail';
  const rows = [`<div class="td-speed"><b>${kmh}</b> km/h${d.v < -0.05 ? ' <i>(marche arrière)</i>' : ''}</div>`,
    `<div class="td-bar"><span style="width:${Math.min(100, (Math.abs(d.v) / d.vmax) * 100)}%"></span></div>`];
  if (d.wait > 0) rows.push(`<div class="td-row td-stop">En gare : départ dans ${Math.ceil(d.wait)} s</div>`);
  if (d.limit) rows.push(`<div class="td-row${Math.abs(d.v) * 3.6 > d.limit + 2 ? ' td-warn' : ''}">Limitation : ${d.limit} km/h</div>`);
  if (d.sign && d.sign.dist < 200) rows.push(`<div class="td-row">Panneau dans ${meters(Math.max(0, d.sign.dist))} : ${d.sign.kmh ? d.sign.kmh + ' km/h' : 'fin de limitation'}</div>`);
  if (driver && d.route?.length) rows.push(`<div class="td-row">Itinéraire : ${d.route.map((s, i) => (i === d.routeI % d.route.length ? '<b>' + esc(s.name) + '</b>' : esc(s.name))).join(' → ')}${d.routeLost ? ' <i class="td-warn">(impossible d\'ici)</i>' : ''}</div>`);
  // annonces : la prochaine gare (à l'approche), puis l'arrivée (carillon)
  if (d.station && d.station.dist < 90 && Math.abs(d.v) > 1 && annStation !== d.station.name) { annStation = d.station.name; announce('Prochain arrêt', d.station.name); }
  if (d.wait > 0 && d.station && annStop !== d.station.name) { annStop = d.station.name; playChime(); announce(d.station.name, 'Départ dans 10 secondes'); }
  if (d.wait <= 0 && Math.abs(d.v) > 3) annStop = null;
  if (driver) {
    rows.push(d.auto !== null ? `<div class="td-row td-auto">Pilote automatique : ${Math.round(d.auto * 3.6)} km/h</div>` : `<div class="td-row">Conduite manuelle (max. ${max} km/h)</div>`);
    if (d.fuel !== null) {
      const pct = Math.min(100, (d.fuel / d.fuelMax) * 100);
      rows.push(`<div class="td-row${d.fuel < 30 ? ' td-warn' : ''}">Combustible : ${fuelText(d.fuel)}</div><div class="td-bar td-fuel"><span style="width:${pct}%"></span></div>`);
    }
  }
  if (d.station) rows.push(`<div class="td-row">Prochaine gare : <b>${esc(d.station.name)}</b> — ${meters(d.station.dist)}</div>`);
  if (driver && d.sw && d.sw.dist < 300) rows.push(`<div class="td-row">Aiguillage dans ${meters(Math.max(0, d.sw.dist))} : ${d.sw.branch ? 'la branche' : 'tout droit'}</div>`);
  if (driver && d.end !== null && d.end < 250) rows.push(`<div class="td-row td-warn">Bout de la voie dans ${meters(Math.max(0, d.end))}</div>`);
  if (driver) rows.push(`<div class="td-row td-small">${d.cars} voiture${d.cars > 1 ? 's' : ''} — P : pilote automatique, H : sifflet, clic molette : menu de la locomotive</div>`);
  dashEl.innerHTML = rows.join('');
}
// ---------- Chapeau (emplacement d'équipement « tête ») ----------
// (la casquette de conducteur : offerte la première fois qu'on conduit une locomotive dans ce monde)
let capGiven = false;
function wearSync() {
  const id = survival.head?.id || 0;
  if (player.hat !== id) player.wear(id);
  if (id === CONDUCTOR_CAP) account.unlock('uniforme');
}
// Le chapeau tenu en main passe sur la tête (l'ancien revient à sa place)
function equipHeld() {
  const id = hotbar[slot];
  if (survival.on) {
    const old = survival.head;
    survival.head = makeSlot(id, 1);
    survival.take(slot, 1);
    if (old) survival.give(old.id, 1, old.w || 0);
  } else survival.head = makeSlot(id, 1);
  playPlace('wool');
  toast(`Tu portes : ${itemName(id)}`);
  wearSync();
  survival.changed?.();
}
// Monté dans une cabine (locomotive ou wagon de queue) : succès, casquette offerte
// Tirer un obus depuis le wagon blindé (là où l'on regarde) ; en survie, il faut un obus
let lastShot = 0;
// ---------- Armes à main (voir weapons.js) ----------
let gunCool = 0, gunAim = false, zoomed = 1, seatCool = 0;
const gunMag = new Map(); // sorte d'arme -> tirs qui restent dans la cellule / le bidon entamé
const gunHud = document.createElement('div');
gunHud.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:6;pointer-events:none;color:#fff;font:600 14px system-ui,sans-serif;text-shadow:0 1px 2px #000;display:none';
document.body.appendChild(gunHud);
const heldGun = () => (state === 'playing' && !player.pilot && !spectator ? ITEMS[hotbar[slot]]?.gun || null : null);
// Munitions de l'arme dans l'inventaire : [id, case] (la première de sa liste qu'on a), ou null
function gunAmmo(G) {
  for (const id of G.ammo) { const i = survival.slots.findIndex((x) => x?.id === id && x.n > 0); if (i >= 0) return [id, i]; }
  return null;
}
function ammoCount(G) { let n = 0; for (const x of survival.slots) if (x && G.ammo.includes(x.id)) n += x.n; return n; }
function fireGun(kind, G) {
  let ammo = G.ammo[G.ammo.length - 1];
  if (survival.on) {
    const left = gunMag.get(kind) || 0;
    if (G.shots && left > 0) { gunMag.set(kind, left - 1); ammo = G.ammo[0]; }
    else {
      const a = gunAmmo(G);
      if (!a) { if (!mouse.gunWarned) toast('Plus de munitions : ' + G.ammo.map((id) => ITEMS[id]?.name || BLOCKS[id]?.name).join(' ou ')); mouse.gunWarned = true; mouse.gun = false; return; }
      ammo = a[0];
      survival.take(a[1], 1);
      if (G.shots) { gunMag.set(kind, G.shots - 1); if (G.empty) survival.give(G.empty, 1); }
    }
  }
  mouse.gunWarned = false;
  gunCool = G.rate;
  updateLook();
  const from = eye.clone().addScaledVector(lookDir, 0.5);
  from.y -= 0.12;
  if (net.isClient) {
    net.csend({ t: 'wp', g: kind, a: ammo, o: [from.x, from.y, from.z], d: [lookDir.x, lookDir.y, lookDir.z] });
    weapons.fireHand(kind, ammo, from, lookDir, { ghost: true });
  } else {
    weapons.fireHand(kind, ammo, from, lookDir, { pid: 0, vel: player.vel });
    if (net.isHost) net.broadcastJoined({ t: 'wpfx', g: kind, a: ammo, o: [from.x, from.y, from.z], d: [lookDir.x, lookDir.y, lookDir.z] });
  }
  // recul : le canon remonte un peu
  if (G.kick) { player.pitch = Math.min(Math.PI / 2 - 0.01, player.pitch + G.kick * (gunAim ? 0.5 : 1)); player.yaw += (Math.random() - 0.5) * G.kick * 0.4; hand.punch(); }
}
function gunTick(dt) {
  gunCool -= dt;
  seatCool -= dt;
  const kind = heldGun(), G = kind && GUNS[kind];
  // viseur : le champ de vision se resserre (on ne touche à rien sinon : les cinématiques le règlent)
  const want = G && gunAim ? G.zoom : 1;
  if (want !== 1 || zoomed !== 1) {
    zoomed += (want - zoomed) * Math.min(1, dt * 14);
    if (Math.abs(zoomed - want) < 0.01) zoomed = want;
    camera.fov = options.fov / zoomed;
    camera.updateProjectionMatrix();
  }
  if (!G) { mouse.gun = false; gunAim = false; }
  else if (mouse.gun && gunCool <= 0 && (G.auto || mouse.gunPress)) { mouse.gunPress = false; fireGun(kind, G); }
  // tir continu depuis un poste de pilotage
  if (mouse.seat && player.pilot && seatCool <= 0) seatFire(false);
  // affichage : munitions de l'arme tenue, ou armes et charge de l'engin piloté
  let text = '';
  if (G) text = ITEMS[hotbar[slot]].name + ' — ' + (survival.on ? ammoCount(G) + (G.shots ? ' (+' + (gunMag.get(kind) || 0) + ' tirs)' : '') : '∞');
  else if (player.pilot?.s && !player.pilot.passenger && !net.isClient) {
    const c = weapons.ship(player.pilot.s);
    if (c.weapons.length) { const [ch, max] = weapons.chargeOf(player.pilot.s); text = 'Armes : ' + c.weapons.length + ' (clic gauche)' + (max ? ' — charge ' + ch + ' / ' + max : '') + (c.emit ? ' — bouclier' : ''); }
  }
  if (gunHud.textContent !== text) { gunHud.textContent = text; gunHud.style.display = text ? '' : 'none'; }
}
// Tir des armes de l'engin piloté (loud : au clic, on dit pourquoi rien ne part)
function seatFire(loud) {
  const s = player.pilot?.s;
  if (!s) return;
  seatCool = 0.1;
  updateLook();
  if (net.isClient) { net.csend({ t: 'wseat', id: s.id, e: [eye.x, eye.y, eye.z], d: [lookDir.x, lookDir.y, lookDir.z], free: !survival.on }); return; }
  const why = weapons.fireSeat(s, eye, lookDir, 0, !survival.on);
  if (why && loud && why !== 'Pas encore rechargé') toast(why);
}
function fireTurret(car) {
  const now = performance.now();
  if (now - lastShot < 1200) return;
  if (survival.on) {
    const i = survival.slots.findIndex((s) => s?.id === SHELL);
    if (i < 0) { toast('Plus d\'obus : il en faut dans ton inventaire'); return; }
    survival.take(i, 1);
  }
  lastShot = now;
  updateLook();
  if (net.isClient) { net.csend({ t: 'tr', a: 'fire', id: car.id, d: [lookDir.x, lookDir.y, lookDir.z] }); playCannon(0); }
  else trains.fire(car, lookDir.clone());
}
function mountedCab(car) {
  account.unlock(car.kind === 'tail' ? 'marche_arriere' : 'en_voiture');
  if (car.kind !== 'loco' || capGiven) return;
  capGiven = true;
  if (survival.on) survival.give(CONDUCTOR_CAP, 1);
  else if (!survival.head) { survival.head = makeSlot(CONDUCTOR_CAP, 1); wearSync(); }
  toast('Première locomotive conduite : voici ta casquette de conducteur ! (inventaire, emplacement « Tête »)');
}
// La locomotive brûle-t-elle cet objet ? (thermique : charbon, bois ; électrique : voltite)
const canFuel = (loco, id) => (net.isClient ? !!(TRAIN_FUEL[id] || ELEC_FUEL[id]) : trains.burns(loco, id));

// ---------- Menu de la locomotive (clic molette dans la cabine) ----------
// Composants : un moteur et 8 emplacements (vitesse, accélération, freins, réservoir, wagons en
// plus...) ; itinéraire : les gares à desservir, dans l'ordre
const locoEl = (id) => document.getElementById('loco-' + id);
let locoCar = null, locoPick = null, locoTimer = 0, locoTabName = 'comp';
const locoSlotEls = { engine: null, parts: [] };
{
  const mk = (parent, slotId) => {
    const el = document.createElement('div');
    el.className = 'slot';
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (e.button === 2) removeComp(slotId);
      else openPick(slotId);
    });
    parent.appendChild(el);
    return el;
  };
  locoSlotEls.engine = mk(locoEl('engine'), 'engine');
  for (let i = 0; i < PART_SLOTS; i++) locoSlotEls.parts.push(mk(locoEl('parts'), i));
  locoEl('tab-comp').addEventListener('click', () => locoTab('comp'));
  locoEl('tab-route').addEventListener('click', () => locoTab('route'));
  locoEl('close').addEventListener('click', () => closePhys(false));
  locoEl('route-add').addEventListener('click', () => {
    const k = locoEl('route-pick').value;
    const d = locoData();
    if (!k || !d) return;
    setRoute([...d.route.map((x) => x.key), k]);
  });
  locoEl('route-clear').addEventListener('click', () => setRoute([]));
  locoEl(`parts`).addEventListener('contextmenu', (e) => e.preventDefault());
}
function openLoco(car) {
  const loco = car.kind === 'loco' ? car : car.train?.cars?.find((c) => c.kind === 'loco');
  if (!loco) return;
  locoCar = loco;
  locoPick = null;
  physTarget = { loco: true };
  state = 'phys';
  keys.clear();
  mouse.left = mouse.right = false;
  show('loco');
  document.exitPointerLock();
  locoTab(locoTabName);
  clearInterval(locoTimer);
  locoTimer = setInterval(renderLoco, 500); // (en ligne : l'hôte renvoie l'état)
}
const locoData = () => (locoCar ? trains.dash(locoCar) : null);
function locoTab(name) {
  locoTabName = name;
  locoEl('tab-comp').classList.toggle('on', name === 'comp');
  locoEl('tab-route').classList.toggle('on', name === 'route');
  locoEl('comp').hidden = name !== 'comp';
  locoEl('route').hidden = name !== 'route';
  renderLoco();
}
const ENGINE_POWER = { fuel: 'charbon, bois', elec: 'voltite', none: 'aucune (fusion)', steam: 'vapeur (charbon, bois ; le tender la remplit)' };
function renderLoco() {
  if (!locoCar) return;
  const d = locoData();
  if (!d) return;
  const fill = (el, id) => { el.innerHTML = ''; if (id) { el.appendChild(blockIcon(id, 48)); el.title = itemName(id); } else el.title = ''; };
  fill(locoSlotEls.engine, d.engine);
  locoSlotEls.parts.forEach((el, i) => fill(el, d.parts[i] || 0));
  const kmh = (v) => Math.round(v * 3.6) + ' km/h';
  const rows = [
    ['Moteur', d.power === 'steam' ? 'Chaudière à vapeur' : d.engine ? itemName(d.engine) : "Moteur d'origine"],
    ['Vitesse max.', kmh(d.vmax)], ['Accélération', d.acc.toFixed(2)], ['Freinage', d.brake.toFixed(1)],
    ['Énergie', ENGINE_POWER[d.power] || '—'],
    ['Réservoir', d.power === 'none' ? '—' : fuelText(d.fuelMax)], ['Consommation', d.power === 'none' ? '0' : d.burn.toFixed(2) + ' /s'],
    ['Wagons', String(d.cars - 1)], ['Poids', (d.load ?? 0).toFixed(1)],
  ];
  // (ce que donnent les composants, cumulés : deux turbos font +69 %, pas +30 % ; ceux qui ne
  // servent pas avec ce moteur sont signalés)
  const pc = (x) => (x >= 1 ? '+' : '−') + Math.round(Math.abs(x - 1) * 100) + ' %';
  const BONUS = {
    turbo: ['Turbocompresseur', (n) => 'accélération ' + pc(1.3 ** n), 'moteur thermique'], sander: ['Sablière', (n) => 'accélération ' + pc(1.1 ** n) + ', pentes ' + pc(0.5 ** n)],
    transformer: ['Transformateur', (n) => 'vitesse, accélération ' + pc(1.15 ** n), 'moteur électrique'], wiring: ['Faisceau de câbles', (n) => 'vitesse ' + pc(1.1 ** n), 'moteur électrique'],
    throttle: ['Manette de traction', (n) => 'vitesse ' + pc(1.05 ** n)], radiator: ['Radiateur', (n) => 'consommation ' + pc(0.8 ** n)],
    pump: ['Pompe à carburant', (n) => 'consommation ' + pc(0.85 ** n), 'moteur thermique'], exhaust: ["Pot d'échappement", (n) => 'consommation ' + pc(0.95 ** n) + ', fumée ' + pc(0.4 ** n)],
    alternator: ['Alternateur', (n) => 'consommation ' + pc(0.95 ** n)], brake: ['Cylindre de frein', (n) => 'freinage ' + pc(1 + 0.5 * n)], air: ["Réservoir d'air", (n) => 'freinage ' + pc(1.25 ** n)],
    tank: ['Réservoir de carburant', (n) => 'réservoir ' + pc(1 + n)], battery: ['Batterie', (n) => 'réservoir ' + pc(1 + 0.5 * n)], traction: ['Moteur de traction', (n) => 'poids des wagons ' + pc(0.8 ** n)],
  };
  for (const b of d.bonus || []) {
    const B = BONUS[b.kind], sp = STEAM_PART[b.kind];
    if (B) rows.push([B[0] + ' ×' + b.n, b.on ? B[1](b.n) : 'sans effet (il faut un ' + B[2] + ')']);
    else if (sp) rows.push([itemName(sp) + ' ×' + b.n, b.on ? steamText(compOf(sp).steam, b.n) : 'sans effet (il faut une locomotive à vapeur)']);
  }
  locoEl('stats').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('');
  // itinéraire
  const list = locoEl('route-list');
  if (locoTabName === 'route' && !list.matches(':hover')) {
    list.innerHTML = '';
    if (!d.route.length) list.innerHTML = '<li class="empty">Aucun itinéraire : le train s\'arrête à toutes les gares</li>';
    d.route.forEach((st, i) => {
      const li = document.createElement('li');
      li.className = i === d.routeI % d.route.length ? 'next' : '';
      li.innerHTML = `<span>${i + 1}. ${esc(st.name)}</span>`;
      const btn = (txt, fn) => { const b = document.createElement('button'); b.textContent = txt; b.addEventListener('click', fn); li.appendChild(b); };
      const keysNow = () => d.route.map((x) => x.key);
      btn('▲', () => { const k = keysNow(); if (i > 0) { [k[i - 1], k[i]] = [k[i], k[i - 1]]; setRoute(k); } });
      btn('▼', () => { const k = keysNow(); if (i < k.length - 1) { [k[i + 1], k[i]] = [k[i], k[i + 1]]; setRoute(k); } });
      btn('✕', () => { const k = keysNow(); k.splice(i, 1); setRoute(k); });
      list.appendChild(li);
    });
    locoEl('route-lost').hidden = !d.routeLost;
    const sel = locoEl('route-pick');
    if (!sel.matches(':focus')) {
      tracks.update();
      const cur = sel.value;
      sel.innerHTML = [...tracks.stations].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((st) => `<option value="${st.key}">${esc(st.name || '?')}</option>`).join('') || '<option value="">(aucune gare)</option>';
      if (cur) sel.value = cur;
    }
  }
}
// Choisir ce qu'on pose dans un emplacement (créatif : tout ; survie : ce qu'on a)
function openPick(slotId) {
  const box = locoEl('pick');
  if (slotId === 'engine' && isSteam(locoCar)) { toast('Une locomotive à vapeur garde sa chaudière : pas de moteur à poser'); return; }
  const want = (id) => { const c = compOf(id); return c && (slotId === 'engine') === (c.slot === 'engine'); };
  let ids;
  if (survival.on) {
    const n = new Map();
    for (const s of survival.slots) if (s && want(s.id)) n.set(s.id, (n.get(s.id) || 0) + s.n);
    ids = [...n];
  } else ids = Object.keys(ITEMS).map(Number).filter(want).map((id) => [id, 0]);
  box.innerHTML = '';
  const title = document.createElement('p');
  title.textContent = ids.length ? (slotId === 'engine' ? 'Choisis un moteur :' : 'Choisis un composant :') : (slotId === 'engine' ? 'Aucun moteur dans ton inventaire' : 'Aucun composant dans ton inventaire');
  box.appendChild(title);
  const grid = document.createElement('div');
  grid.className = 'loco-pick-grid';
  for (const [id, n] of ids) {
    const el = document.createElement('div');
    el.className = 'slot';
    el.title = itemName(id) + compText(id);
    el.appendChild(blockIcon(id, 44));
    if (n) { const c = document.createElement('span'); c.className = 'count'; c.textContent = n; el.appendChild(c); }
    el.addEventListener('mousedown', (e) => { e.preventDefault(); installComp(slotId, id); box.hidden = true; });
    grid.appendChild(el);
  }
  box.appendChild(grid);
  box.hidden = false;
  locoPick = slotId;
}
// Ce que fait un composant (bulle d'aide)
function compText(id) {
  const c = compOf(id);
  if (!c) return '';
  if (c.slot === 'engine') return ` — ${Math.round(c.vmax * 3.6)} km/h, accélération ×${c.acc}, énergie : ${ENGINE_POWER[c.power]}`;
  if (c.steam) return ' — ' + steamText(c.steam, 1) + ' (locomotive à vapeur) — se cumule';
  return ' — ' + ({
    tank: 'réservoir +100 %', air: 'freinage +25 %', battery: 'réservoir +50 %', turbo: 'accélération +30 % (moteur thermique)',
    radiator: 'consommation −20 %', alternator: 'phares plus puissants, consommation −5 %', pump: 'consommation −15 % (moteur thermique)',
    exhaust: 'moins de fumée, consommation −5 %', horn: 'un autre klaxon', throttle: 'vitesse max. +5 %', brake: 'freinage +50 %',
    sander: 'pentes deux fois moins dures, accélération +10 %', wiring: 'vitesse max. +10 % (moteur électrique)',
    transformer: 'vitesse et accélération +15 % (moteur électrique)', traction: 'train 20 % moins lourd : tire plus de wagons sans ralentir',
    whistle: 'le klaxon devient un sifflet à vapeur',
  })[c.kind] + (c.kind === 'horn' || c.kind === 'whistle' ? '' : ' — se cumule');
}
// Ce que fait une pièce de locomotive à vapeur, n fois (ses effets se multiplient)
const STEAM_WORDS = { vmax: 'vitesse', acc: 'accélération', burn: 'consommation', tank: 'réservoir', brake: 'freinage', slope: 'pentes', smoke: 'fumée', mass: 'poids des wagons' };
function steamText(s, n) {
  return Object.entries(s).map(([key, x]) => { const v = x ** n; return STEAM_WORDS[key] + ' ' + (v >= 1 ? '+' : '−') + Math.round(Math.abs(v - 1) * 100) + ' %'; }).join(', ');
}
function installComp(slotId, id) {
  if (!locoCar) return;
  if (survival.on) {
    const i = survival.slots.findIndex((s) => s?.id === id);
    if (i < 0) return;
    survival.take(i, 1);
  }
  if (net.isClient) net.csend({ t: 'tr', a: 'comp', id: locoCar.id, slot: slotId, item: id });
  else {
    const old = trains.setComp(locoCar, slotId, id);
    if (old > 0 && survival.on) giveBack([{ id: old, n: 1 }], player.pos);
  }
  playPlace('rail');
  if (slotId === 'engine') { account.unlock('mecano'); if (id === 535) account.unlock('fusion'); }
  setTimeout(() => { const d = locoData(); if (d && d.parts.filter(Boolean).length + (slotId !== 'engine' && !d.parts[slotId] ? 1 : 0) >= PART_SLOTS) account.unlock('tuning'); renderLoco(); }, 60);
  renderLoco();
}
function removeComp(slotId) {
  if (!locoCar) return;
  const d = locoData();
  const cur = slotId === 'engine' ? d?.engine : d?.parts[slotId];
  if (!cur) return;
  if (net.isClient) net.csend({ t: 'tr', a: 'comp', id: locoCar.id, slot: slotId, item: 0 });
  else {
    const old = trains.setComp(locoCar, slotId, 0);
    if (old > 0 && survival.on) giveBack([{ id: old, n: 1 }], player.pos);
  }
  playClick();
  renderLoco();
}
function setRoute(keys) {
  if (!locoCar) return;
  if (net.isClient) net.csend({ t: 'tr', a: 'route', id: locoCar.id, keys });
  else trains.setRoute(locoCar, keys);
  if (keys.length >= 3) account.unlock('horaires');
  playClick();
  setTimeout(renderLoco, net.isClient ? 300 : 0);
}

// Klaxon du train où l'on est : chaque sorte de train a le sien (diesel : trompe grave ; électrique :
// deux tons ; fusion : son synthétique ; vapeur carénée : sifflet clair ; vapeur camouflée :
// sifflet grave et rauque ; avertisseur, sifflet à vapeur : les composants), un peu plus aigu ou
// plus grave d'un train à l'autre (on les reconnaît)
function trainHorn(car) {
  const t = car.train, loco = t ? locoOf(t) : null;
  const pitch = 0.88 + (((t?.id ?? 0) * 37) % 9) * 0.03;
  const L = !net.isClient && t ? trains.limits(t) : null;
  if (STYLES[loco?.style]?.whistle === 'war') playWhistle(0, 'war', pitch);
  else if (isSteam(loco) || L?.whistle) playWhistle(0, 'clear', pitch);
  else if (L?.horn) playHorn2(pitch);
  else playHorn(L?.power === 'elec' ? 'elec' : L?.power === 'none' ? 'fusion' : 'diesel', pitch);
}

// ---------- En train : annonces, bruit du moteur, succès ----------
const announceEl = Object.assign(document.createElement('div'), { id: 'announce' });
document.body.appendChild(announceEl);
let announceT = 0;
function announce(text, sub = '') {
  announceEl.innerHTML = `<b>${esc(text)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
  announceEl.classList.add('on');
  announceT = 4;
}
let annStation = null, annStop = null, kmAcc = 0;
function trainTick(dt) {
  statTick(dt);
  if (current || online) commands.tick(dt);
  if (announceT > 0 && (announceT -= dt) <= 0) announceEl.classList.remove('on');
  // bruit du moteur : la locomotive la plus proche (celle où l'on est, d'abord)
  let best = null, bd = 70;
  for (const t of trains.trains) {
    const c = locoOf(t);
    if (!c) continue;
    const d = player.riding?.train === t ? 0 : c.pos.distanceTo(player.pos);
    if (d < bd) { bd = d; best = c; }
  }
  if (best && inGameNow()) {
    const t = best.train, speed = Math.abs(net.isClient ? best.vel.length() : t.v);
    const effort = Math.max(0, Math.min(1, ((net.isClient ? best.accS : t.accel) || 0) / 3));
    const fall = Math.max(0, 1 - bd / 70) ** 1.5, braking = net.isClient ? (best.accS || 0) < -3.5 && speed > 2 : t.braking;
    engineSound(fall * (0.35 + effort * 0.5 + Math.min(0.4, speed / 50)), speed, effort, isSteam(best) ? 'steam' : net.isClient ? 'fuel' : trains.limits(t).power, braking ? fall * Math.min(1, speed / 12) : 0);
  } else engineSound(0, 0, 0);
  // à bord d'un train : distance, vitesse, nuit, pente, étage du wagon plat
  const car = player.riding?.isTrain ? player.riding : null;
  if (car) {
    const v = Math.abs(net.isClient ? car.vel.length() : car.train.v);
    kmAcc += v * dt;
    if (kmAcc > 50) {
      if (fairPlay()) account.track('train_m', Math.round(kmAcc));
      const km = account.bump('train_m', Math.round(kmAcc)) / 1000;
      kmAcc = 0;
      if (km >= 1) account.unlock('km1');
      if (km >= 10) account.unlock('km10');
      if (km >= 100) account.unlock('km100');
    }
    if (v * 3.6 >= 100) account.unlock('vitesse100');
    if (v * 3.6 >= 200) account.unlock('vitesse200');
    if (v > 2 && sky.daylight < 0.3) account.unlock('train_nuit');
    if (v > 1 && car.dir.y > 0.08) account.unlock('rampe');
    if (car.kind === 'tail' && v > 1) account.unlock('marche_arriere');
  }
  const deck = player.standingOn?.carrier;
  if (deck?.kind === 'flat2' && structs.toLocal(player.standingOn, player.pos, new THREE.Vector3()).y > 3.5) account.unlock('deux_niveaux');
  travelTick(dt);
}
const inGameNow = () => state === 'playing' || state === 'phys' || state === 'craft' || state === 'inventory';

// ---------- Voyageurs ----------
// Des villageois vont attendre à la gare de leur village (sur le quai, entre la voie et la gare),
// montent dans le wagon passagers d'un train arrêté là, et descendent à une autre gare : ils
// s'installent alors dans le village le plus proche
let travelT = 3;
function stationSpot(st) {
  if (st.spot !== undefined) return st.spot;
  const h = tracks.nearest(st.pos.x, st.pos.y, st.pos.z, 1, 0, 6);
  if (!h) return (st.spot = null);
  const p = tracks.pointAt(h, new THREE.Vector3()), d = new THREE.Vector3(st.pos.x - p.x, 0, st.pos.z - p.z);
  if (d.lengthSq() < 0.01) d.set(1, 0, 0);
  d.normalize();
  return (st.spot = new THREE.Vector3(p.x + d.x * 2.7, st.y, p.z + d.z * 2.7));
}
function travelTick(dt) {
  if (net.isClient || !tracks.stations.length || (travelT -= dt) > 0) return;
  travelT = 5;
  for (const st of tracks.stations) {
    const spot = stationSpot(st);
    if (!spot || animals.list.filter((a) => a.travel?.st === st.key).length >= 3 || Math.random() > 0.4) continue;
    const cand = animals.list.filter((a) => a.type === 'villager' && a.active && !a.dead && !a.travel && !a.riding && !a.seat && !a.mode && a.home
      && Math.hypot(a.pos.x - st.pos.x, a.pos.z - st.pos.z) < 48);
    if (!cand.length) continue;
    cand[Math.floor(Math.random() * cand.length)].travel = { st: st.key, spot, since: 0 };
  }
}
animals.travelThink = (a, dt) => {
  const T = a.travel, st = tracks.stations.find((s) => s.key === T.st);
  T.since += dt;
  if (!st || T.since > 300) { a.travel = null; return false; } // (personne n'est venu : il rentre)
  if (Math.hypot(a.pos.x - T.spot.x, a.pos.z - T.spot.z) > 1.3) { a.target = { x: T.spot.x, z: T.spot.z }; a.state = 'walk'; a.timer = 2; }
  else { a.target = null; a.state = 'idle'; a.timer = 1; a.headTarget = 0; }
  return true;
};
// Un train s'arrête en gare : ses voyageurs d'ailleurs descendent, ceux qui attendent montent
function travelStop(t, st) {
  const seats = t.cars.filter((c) => c.kind === 'passenger');
  if (!seats.length) return;
  for (const c of seats) for (const a of [...c.seats]) {
    if (!a?.type || a.trip?.from === st.key) continue;
    trains.dismount(a);
    a.riding = null;
    a.trip = null;
    // (il s'installe ici : le village le plus proche le prendra, voir colony.villageOf)
    a.home = { x: st.pos.x, z: st.pos.z };
    a.vk = undefined;
    a.house = null;
    if (st.pos.distanceTo(player.pos) < 96 || aboard(t)) {
      account.unlock('voyageur');
      if (account.bump('voyageurs') >= 10) account.unlock('compagnie');
    }
  }
  const waiting = animals.list.filter((a) => a.travel?.st === st.key && !a.dead && Math.hypot(a.pos.x - a.travel.spot.x, a.pos.z - a.travel.spot.z) < 5);
  for (const a of waiting) {
    const car = seats.find((c) => c.seats.some((s) => !s));
    if (!car) break;
    if (trains.mount(car, a)) { a.travel = null; a.trip = { from: st.key }; }
  }
}
const fuelText = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${String(Math.floor(s % 60)).padStart(2, '0')} s` : `${Math.floor(s)} s`);
// ---------- Bloc de structure ----------
const stPreview = new RegionPreview(scene);
const stEl = (id) => document.getElementById('st-' + id);
const stStatus = stEl('status');
let stAt = null;           // { q, r, y } du bloc ouvert
let stTab = 'save';
const stMemory = new Map(); // derniers réglages de chaque bloc (pendant la partie)
const stNum = (id, min, max, def) => {
  const v = Math.round(Number(stEl(id).value));
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : def;
};
function stOffset() { return { x: stNum('ox', -256, 256, 1), y: stNum('oy', -H, H, 0), z: stNum('oz', -256, 256, 0) }; }
function stSize() { return { x: stNum('sx', 1, MAX_SIZE, 5), y: stNum('sy', 1, H, 5), z: stNum('sz', 1, MAX_SIZE, 5) }; }
function stSelected() { return structStore.list().find((s) => s.name === stEl('list').value) || null; }
// cadre bleu : la zone à sauvegarder, ou là où ira la structure choisie
function stRefreshPreview() {
  if (!stAt) { stPreview.hide(); return; }
  const { q, r, y } = stAt;
  if (stTab === 'save') stPreview.show(regionCells(q, r, y, stOffset(), stSize()));
  else {
    const s = stSelected();
    if (s) stPreview.show(placement(s.data, q, r, y, stOffset(), Number(stEl('rot').value)));
    else stPreview.hide();
  }
}
function stFillList(select = null) {
  const list = stEl('list');
  list.innerHTML = '';
  for (const s of structStore.list()) {
    const o = document.createElement('option');
    o.value = s.name;
    o.textContent = `${s.name}  (${s.data.blocks.length} blocs)`;
    list.appendChild(o);
  }
  if (select) list.value = select;
  if (!list.value && list.options.length) list.selectedIndex = 0;
}
function stShowTab(tab) {
  stTab = tab;
  stEl('tab-save').classList.toggle('on', tab === 'save');
  stEl('tab-load').classList.toggle('on', tab === 'load');
  stEl('save').hidden = tab !== 'save';
  stEl('load').hidden = tab !== 'load';
  if (tab === 'load') stFillList(stEl('list').value);
  stStatus.textContent = tab === 'load' && !stEl('list').options.length ? 'Aucune structure enregistrée pour l\'instant.' : '';
  stRefreshPreview();
}
function openStructure(q, r, y) {
  if (net.isClient) { toast("Le bloc de structure marche seulement chez l'hôte pour l'instant"); return; }
  stAt = { q, r, y };
  const m = stMemory.get(q + ',' + r + ',' + y) || { o: [1, 0, 0], s: [5, 5, 5], name: '' };
  ['ox', 'oy', 'oz'].forEach((k, i) => { stEl(k).value = m.o[i]; });
  ['sx', 'sy', 'sz'].forEach((k, i) => { stEl(k).value = m.s[i]; });
  stEl('name').value = m.name;
  physTarget = { structure: true };
  state = 'phys';
  keys.clear();
  mouse.left = mouse.right = false;
  show('structure');
  document.exitPointerLock();
  stShowTab(stTab);
}
function stRemember() {
  if (!stAt) return;
  const o = stOffset(), s = stSize();
  stMemory.set(stAt.q + ',' + stAt.r + ',' + stAt.y, { o: [o.x, o.y, o.z], s: [s.x, s.y, s.z], name: stEl('name').value.trim() });
}
stEl('tab-save').addEventListener('click', () => stShowTab('save'));
stEl('tab-load').addEventListener('click', () => stShowTab('load'));
for (const k of ['ox', 'oy', 'oz', 'sx', 'sy', 'sz', 'list', 'rot']) stEl(k).addEventListener('input', stRefreshPreview);
stEl('save-btn').addEventListener('click', () => {
  if (!stAt) return;
  const name = stEl('name').value.trim();
  if (!validStructName(name)) { stStatus.textContent = 'Nom : 1 à 40 lettres, chiffres, espaces, _ ou -'; return; }
  const data = capture(world, structs, stAt.q, stAt.r, stAt.y, stOffset(), stSize());
  if (!data.blocks.length) { stStatus.textContent = 'La zone est vide : rien à sauvegarder.'; return; }
  const exists = structStore.list().some((s) => s.name === name);
  stStatus.textContent = structStore.write(name, data)
    ? `« ${name} » ${exists ? 'remplacée' : 'sauvegardée'} : ${data.blocks.length} blocs ✓`
    : 'Erreur : sauvegarde impossible';
  stRemember();
});
stEl('place').addEventListener('click', () => {
  const s = stSelected();
  if (!stAt || !s) { stStatus.textContent = 'Choisis d\'abord une structure.'; return; }
  const n = placeStructure(world, structs, s.data, stAt.q, stAt.r, stAt.y, stOffset(), Number(stEl('rot').value));
  stStatus.textContent = `« ${s.name} » placée : ${n} blocs ✓`;
  world.changed = true;
  stRemember();
});
stEl('delete').addEventListener('click', async () => {
  const s = stSelected();
  if (!s) return;
  if (!(await ask(`Supprimer la structure « ${s.name} » ?`, 'Supprimer', 'Annuler'))) return;
  structStore.remove(s.name);
  stShowTab('load');
});
stEl('folder').addEventListener('click', () => {
  stStatus.textContent = structStore.openFolder()
    ? 'Dossier ouvert : copie-y les fichiers .json reçus pour les importer, ou envoie les tiens pour les partager.'
    : 'Le dossier des structures n\'existe que dans l\'application.';
});
stEl('close').addEventListener('click', () => closePhys(false));

// (hôte) Réglage de la clé à molette envoyé par un invité : bloc physique (x, y, z) ou gravitron
function setPhys(sid, k, p) {
  if (!((p.length === 3 && p.every((v) => Number.isFinite(v) && Math.abs(v) <= 30)) || validGrav(p))) return;
  if (sid !== null) {
    const s = structs.byId(sid);
    if (s && hasParams(s.blocks.get(k))) structs.setParams(s, k, p);
  } else {
    const [q, r, y] = k.split(',').map(Number);
    if (hasParams(world.getBlock(q, r, y))) structs.worldParams.set(k, p);
  }
  world.changed = true;
}

function closePhys(apply) {
  if (state !== 'phys') return;
  if (physTarget?.schem) apply = false;
  if (physTarget?.orb) { orbital.closePanel(); apply = false; }
  if (physTarget?.structure) { stRemember(); stAt = null; stPreview.hide(); apply = false; }
  if (physTarget?.loco) { clearInterval(locoTimer); locoCar = null; locoPick = null; }
  else if (physTarget?.station) {
    const name = targetInput.value.trim().slice(0, TARGET_NAME_MAX);
    if (apply && name) {
      if (net.isClient) { const [q, r, y] = physTarget.station.split(',').map(Number); net.csend({ t: 'tr', a: 'name', q, r, y, name }); }
      else tracks.rename(physTarget.station, name);
      world.changed = true;
      toast(`Gare : « ${name} »`);
    }
  } else if (physTarget?.target) {
    const name = targetInput.value.trim().slice(0, TARGET_NAME_MAX);
    if (apply && name && targetNames.has(physTarget.target)) {
      targetNames.set(physTarget.target, name);
      if (net.isClient) net.csend({ t: 'tgt', k: physTarget.target, n: name });
      shareTargets();
      world.changed = true;
      toast(`Bloc cible : « ${name} »`);
    }
  } else if (apply && physTarget?.grav) {
    let p = gravInputs.map((el) => Math.max(-1e6, Math.min(1e6, Number(el.value.replace(',', '.')) || 0)));
    const mode = physTarget.car ? 3 : Number(document.querySelector('input[name="grav-mode"]:checked')?.value) || 0;
    p.push(mode);
    // parcours : [x0, y0, z0, mode, boucle, arrêt0, x1, y1, z1, arrêt1, ...]
    if (gravStops.length) {
      const [first, ...rest] = gravStops;
      p = [...first.pos, mode, gravLoop.checked ? 1 : 0, first.wait];
      for (const st of rest) p.push(...st.pos, st.wait);
    }
    if (net.isClient) net.csend({ t: 'phys', s: physTarget.struct?.id ?? null, k: physTarget.key, p });
    if (physTarget.struct) structs.setParams(physTarget.struct, physTarget.key, p);
    else structs.worldParams.set(physTarget.key, p);
    if (physTarget.struct?.car && !net.isClient) {
      const tac = document.getElementById('grav-tactic').value;
      weapons.setTactic(physTarget.struct, tac);
      if (tac && !physTarget.car && p[3] !== 3) toast("Stratégie réglée : elle ne compte qu'en mode Voiture");
      if (tac && !weapons.teamOfStruct(physTarget.struct)) toast("Stratégie réglée, mais la voiture n'a pas d'équipe : clé à molette sur une de ses tourelles");
    }
    world.changed = true;
    const to = gravTarget.value && targetNames.get(gravTarget.value);
    if (gravStops.length) toast(`${physTarget.car ? 'Pilote de route' : 'Gravitron : ' + GRAV_NAMES[p[3]]}, parcours de ${gravStops.length} étape${gravStops.length > 1 ? 's' : ''}${gravLoop.checked ? ' en boucle' : ''}`);
    else toast(`${physTarget.car ? 'Pilote de route' : 'Gravitron : ' + GRAV_NAMES[p[3]]} vers ${to ? '« ' + to + ' »' : p[0] + ' / ' + p[1] + ' / ' + p[2]}`);
  } else if (apply && physTarget) {
    const p = physInputs.map((el) => Math.max(-30, Math.min(30, Number(el.value.replace(',', '.')) || 0)));
    if (net.isClient) net.csend({ t: 'phys', s: physTarget.struct?.id ?? null, k: physTarget.key, p });
    if (physTarget.struct) structs.setParams(physTarget.struct, physTarget.key, p);
    else structs.worldParams.set(physTarget.key, p);
    world.changed = true;
    toast(`Bloc physique : x ${p[0]}, y ${p[1]}, z ${p[2]}`);
  }
  physTarget = null;
  hideScreens();
  state = 'paused';
  lock(true);
}
document.getElementById('phys-ok').addEventListener('click', () => closePhys(true));
document.getElementById('phys-cancel').addEventListener('click', () => closePhys(false));
document.getElementById('grav-ok').addEventListener('click', () => closePhys(true));
document.getElementById('grav-cancel').addEventListener('click', () => closePhys(false));
document.getElementById('target-ok').addEventListener('click', () => closePhys(true));
document.getElementById('target-cancel').addEventListener('click', () => closePhys(false));

// Côté de la case (q, r) tourné vers le joueur (face avant d'un four ou d'un coffre)
// Côté de la case (q, r) tourné vers le joueur (from : sa position, dans le repère de la
// grille de la case : le monde, ou un objet collé)
function sideToward(q, r, from = player.pos) {
  const c = hexToWorld(q, r), dx = from.x - c.x, dz = from.z - c.z;
  let best = 0, bestDot = -Infinity;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i, d = dx * Math.cos(a) + dz * Math.sin(a);
    if (d > bestDot) { bestDot = d; best = i; }
  }
  return best;
}

// Case où la dalle tenue complète une dalle (horizontale avec horizontale, verticale avec
// verticale ; même matière : le bloc plein, sinon deux dalles) : { q, r, y, id } ou null
// (tg : la visée, dans le monde ou sur un objet ; get : les blocs de la même grille)
function slabToFill(item, tg = target, get = (q, r, y) => world.getBlock(q, r, y)) {
  const vertical = BLOCKS[item].vslab !== undefined;
  const at = (c) => {
    if (!c) return null;
    const cur = get(c.q, c.r, c.y), cb = BLOCKS[cur];
    if (!SLAB[cur] || (cb.vslab !== undefined) !== vertical) return null;
    const add = vertical ? slabVariant(item, (cb.vslab + 3) % 6) : slabVariant(item, cb.slab === 'top' ? 'bottom' : 'top');
    const id = slabCombine(cur, add);
    return id ? { q: c.q, r: c.r, y: c.y, id, add } : null;
  };
  return (tg.into && at(tg.hit)) || at(tg.prev);
}

// Dalle posée en haut ou en bas de sa case : sous un bloc, en haut ; sur un bloc, en bas ;
// contre un côté, selon la moitié visée
// Dalle verticale : contre le côté d'un bloc, la moitié qui le touche ; sur le dessus ou le
// dessous, la moitié où tombe le point visé
// (tg : la visée ; P : le point visé, dans la même grille — sur un objet, dans son repère)
function slabHalf(item, tg = target, P = null) {
  const b = BLOCKS[item];
  if (!P) P = eye.clone().addScaledVector(lookDir, tg.t);
  if (b.vslab !== undefined) {
    const h = tg.hit, p = tg.prev;
    if (p.y === h.y) {
      const k = NEIGHBORS.findIndex(([a, c]) => p.q + a === h.q && p.r + c === h.r);
      if (k >= 0) return slabVariant(item, k);
    }
    const c = hexToWorld(p.q, p.r), x = P.x - c.x, z = P.z - c.z;
    let best = 0, bd = -Infinity;
    for (let k = 0; k < 6; k++) {
      const d = x * Math.cos((Math.PI / 3) * k) + z * Math.sin((Math.PI / 3) * k);
      if (d > bd) { bd = d; best = k; }
    }
    return slabVariant(item, best);
  }
  const top = b.slab === 'top' ? item : b.other, bottom = b.slab === 'bottom' ? item : b.other;
  const h = tg.hit, p = tg.prev;
  if (p.y < h.y) return top;
  if (p.y > h.y) return bottom;
  const fy = P.y - h.y;
  return fy >= 0.5 ? top : bottom;
}

// ---------- Main gravitationnelle ----------
// Attrape un objet collé par le point visé ; il reste devant le joueur, à la même
// distance (molette pour la changer). Le poids ne compte pas. En ligne, l'hôte simule :
// le client lui envoie la cible 20 fois par seconde.
const GRAB_MIN = 1.5, GRAB_MAX = 75; // portée : 75 blocs
let grab = null; // { id, local, dist }
let grabSend = 0;
const grabTarget = new THREE.Vector3();
const grabBeam = (() => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.85, depthTest: false }));
  line.renderOrder = 5;
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);
  return line;
})();

function startGrab(ts) {
  const s = ts.struct;
  if (player.standingOn === s) { toast('Impossible : tu es debout dessus'); return; }
  const point = eye.clone().addScaledVector(lookDir, ts.t);
  grab = { id: s.id, local: structs.toLocal(s, point, new THREE.Vector3()), dist: Math.max(GRAB_MIN, Math.min(GRAB_MAX, ts.t)) };
  grabTarget.copy(eye).addScaledVector(lookDir, grab.dist);
  if (net.isClient) net.csend({ t: 'sgrab', id: s.id, p: point.toArray(), tp: grabTarget.toArray() });
  else structs.hold(0, s, point, grabTarget);
  account.unlock('telekinesie');
}

function releaseGrab(vel = null) {
  if (!grab) return;
  grab = null;
  grabBeam.visible = false;
  if (net.isClient) net.csend({ t: 'sdrop', v: vel ? vel.toArray() : null });
  else structs.drop(0, vel);
}

// Faire tourner l'objet tenu : clic gauche (Maj : dans l'autre sens), autour de l'axe choisi
// avec R (vus depuis le joueur) :
//  Y : autour de la verticale (60°, le pas des hexagones)
//  X : le basculer vers l'avant / l'arrière (45°)    Z : le pencher sur le côté (45°)
// X (la touche) : le redresser
const GRAB_AXES = ['Y', 'X', 'Z'];
const GRAB_AXIS_NAMES = { Y: 'Y (autour de la verticale)', X: 'X (basculer vers l\'avant)', Z: 'Z (pencher sur le côté)' };
let grabAxis = 'Y';
function nextGrabAxis() {
  grabAxis = GRAB_AXES[(GRAB_AXES.indexOf(grabAxis) + 1) % GRAB_AXES.length];
  toast(`Axe de rotation : ${GRAB_AXIS_NAMES[grabAxis]}`);
}
function turnGrab(back) {
  const sign = back ? -1 : 1;
  let axis, angle;
  if (grabAxis === 'Y') { axis = new THREE.Vector3(0, 1, 0); angle = sign * Math.PI / 3; }
  else if (grabAxis === 'X') { axis = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw)); angle = -sign * Math.PI / 4; }
  else { axis = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)); angle = sign * Math.PI / 4; }
  if (net.isClient) net.csend({ t: 'sturn', a: axis.toArray(), g: angle });
  else structs.holdTurn(0, axis, angle);
}
function straightenGrab() {
  if (net.isClient) net.csend({ t: 'sturn', a: null, g: 0 });
  else structs.holdTurn(0, null, 0);
}

// À chaque image : la cible suit le regard, le rayon relie la main à l'objet
function updateGrab(dt) {
  if (!grab) return;
  const s = structs.byId(grab.id);
  if (!s || hotbar[slot] !== GRAVITY_HAND || player.riding) { releaseGrab(); return; }
  grabTarget.copy(eye).addScaledVector(lookDir, grab.dist);
  if (net.isClient) {
    grabSend -= dt;
    if (grabSend <= 0) { grabSend = 0.05; net.csend({ t: 'shold', tp: grabTarget.toArray() }); }
  } else structs.holdTarget(0, grabTarget);
  // rayon : de la main vers le point tenu
  const p = grabBeam.geometry.attributes.position;
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const from = eye.clone().addScaledVector(lookDir, 0.6).addScaledVector(right, viewMode === 0 ? 0.28 : 0.4).add(new THREE.Vector3(0, -0.28, 0));
  const to = structs.toWorld(s, grab.local, new THREE.Vector3());
  // (par rapport à la main : loin du centre du monde, des positions en 32 bits tremblent)
  grabBeam.position.copy(from);
  p.setXYZ(0, 0, 0, 0);
  p.setXYZ(1, to.x - from.x, to.y - from.y, to.z - from.z);
  p.needsUpdate = true;
  grabBeam.visible = true;
}

// Corps qui touchent les cordes : le joueur (qui peut marcher dessus), les autres joueurs (ils
// écartent la corde), les animaux (posés dessus et repoussés chez l'hôte)
function ropeBodies() {
  if (!ropes.list.length) return [];
  const out = [];
  if (state === 'playing' && !player.riding && !player.fly) {
    out.push({ pos: player.pos, vel: player.vel, radius: PLAYER_RADIUS, height: PLAYER_HEIGHT, move: true, ground: () => { player.onGround = true; } });
  }
  for (const rp of net.remotes.values()) out.push({ pos: rp.pos, vel: { y: 0 }, radius: PLAYER_RADIUS, height: PLAYER_HEIGHT, move: false });
  for (const a of animals.list) {
    if (!a.active || a.dead) continue;
    const sp = SPECIES[a.type];
    out.push({ pos: a.pos, vel: a.vel, radius: sp.radius, height: sp.height, move: !animals.remote, ground: () => { a.onGround = true; a.fallFrom = a.pos.y; } });
  }
  return out;
}

// Corde : bout accroché au bloc visé (du monde, ou d'un objet collé), ou null
function ropeEnd() {
  if (targetStruct && !(target && target.t < targetStruct.t)) {
    const s = targetStruct.struct, h = targetStruct.hit;
    const point = eye.clone().addScaledVector(lookDir, targetStruct.t - 0.02);
    return { s: s.id, p: structs.toLocal(s, point, new THREE.Vector3()).toArray(), c: [h.q, h.r, h.y] };
  }
  if (!target) return null;
  const h = target.hit, point = eye.clone().addScaledVector(lookDir, target.t - 0.02);
  return { s: null, p: point.toArray(), c: [h.q, h.r, h.y] };
}
// Premier clic : un bout ; deuxième clic : l'autre bout, la corde est tendue (avec un peu de
// mou). Maj + clic droit : retire les cordes accrochées au bloc visé (rendues en survie).
function useRope(shift) {
  const e = ropeEnd();
  if (!e) { toast('Vise un bloc ou un objet collé'); return; }
  if (shift) {
    if (net.isClient) { net.csend({ t: 'ropedel', s: e.s, c: e.c }); return; }
    const list = ropes.at(e.s, e.c);
    if (!list.length) { toast('Aucune corde accrochée à ce bloc'); return; }
    for (const r of list) ropes.remove(r);
    if (survival.on && survival.give(ROPE, list.length)) toast('Inventaire plein');
    toast(list.length > 1 ? `${list.length} cordes retirées` : 'Corde retirée');
    return;
  }
  if (!ropeFirst) { ropeFirst = e; toast('Premier bout accroché : clic droit sur le deuxième point'); return; }
  const a = ropeFirst;
  ropeFirst = null;
  if (a.s === e.s && a.c.join() === e.c.join()) { toast('Corde annulée'); return; }
  const pa = ropes.point(a, new THREE.Vector3()), pb = ropes.point(e, new THREE.Vector3());
  if (!pa || !pb) { toast('Le premier bout a disparu'); return; }
  if (pa.distanceTo(pb) > ROPE_MAX) { toast(`Trop loin : une corde fait au plus ${ROPE_MAX} blocs`); return; }
  if (net.isClient) net.csend({ t: 'rope', a, b: e });
  else if (!ropes.add(a, e)) { toast('Impossible de tendre la corde ici'); return; }
  account.unlock('corde');
  useHeld();
  hand.punch();
}

// Double colle : premier clic sur un objet collé, deuxième clic sur un autre objet qui le
// touche : le second est collé au premier (un seul objet). Utilisée seulement si ça marche.
function useDoubleGlue() {
  const s = targetStruct?.struct;
  if (!s) { toast(mergeFirst ? 'Vise le deuxième objet collé' : 'Vise un objet collé (fait avec la super colle)'); return; }
  if (!mergeFirst || !structs.list.includes(mergeFirst)) {
    mergeFirst = s;
    toast('Premier objet choisi : clic droit sur le deuxième objet (qui doit le toucher)');
    return;
  }
  if (s === mergeFirst) { mergeFirst = null; toast('Double colle annulée'); return; }
  const a = mergeFirst;
  mergeFirst = null;
  if (net.isClient) { net.csend({ t: 'smerge', a: a.id, b: s.id }); useHeld(); hand.punch(); return; }
  const why = structs.merge(a, s);
  if (why) { toast(why); return; }
  useHeld();
  hand.punch();
  toast(`Objets collés : ${a.list.length} blocs, ${a.mass >= 1000 ? (a.mass / 1000).toFixed(1) + ' t' : Math.round(a.mass) + ' kg'}`);
}

// Super colle : coller / décoller un bloc, assembler, reposer un objet
// Succès : un objet physique assemblé (de n blocs)
function assembled(n) {
  account.unlock('assemble');
  if (n >= 100) account.unlock('gros_objet');
  if (n >= 1000) account.unlock('colosse');
}
function useGlue(shift) {
  if (targetStruct) {
    if (!shift) { toast('Maj + clic droit pour reposer l\'objet dans le monde'); return; }
    const s = targetStruct.struct;
    if (net.isClient) net.csend({ t: 'sdis', id: s.id });
    else if (!structs.disassemble(s)) toast('Pas assez de place pour reposer l\'objet ici');
    return;
  }
  if (!target) return;
  const { q, r, y } = target.hit;
  if (shift) {
    const cells = structs.gluedGroup(q, r, y);
    if (!cells.length) { toast('Colle d\'abord des blocs (clic droit), puis Maj + clic droit sur l\'un d\'eux'); return; }
    assembled(cells.length);
    if (net.isClient) {
      net.csend({ t: 'sasm', cells });
      for (const [a, b, c] of cells) structs.glued.delete(a + ',' + b + ',' + c);
      structs.renderGlue();
    } else {
      const s = structs.assemble(cells);
      if (s) toast(`Objet assemblé : ${s.list.length} bloc${s.list.length > 1 ? "s" : ""}, ${s.mass >= 1000 ? (s.mass / 1000).toFixed(1) + " t" : Math.round(s.mass) + " kg"}`);
    }
    return;
  }
  if (!structs.toggleGlue(q, r, y)) toast('Ce bloc ne peut pas être collé');
}

function pickBlock() {
  if (spectator) return;
  // survie : on ne fait que sélectionner le bloc s'il est déjà dans la barre
  if (survival.on) {
    let id = targetStruct
      ? targetStruct.struct.blocks.get(targetStruct.hit.q + ',' + targetStruct.hit.r + ',' + targetStruct.hit.y)
      : target ? world.getBlock(target.hit.q, target.hit.r, target.hit.y) : targetCart ? (targetCart.isTrain ? (targetCart.kind === 'loco' ? LOCOMOTIVE : WAGON) : HEXACART) : 0;
    id = BLOCKS[id]?.pick ?? id;
    const i = id ? hotbar.indexOf(id) : -1;
    if (i >= 0) selectSlot(i);
    return;
  }
  if (targetStruct) {
    const s = targetStruct.struct, h = targetStruct.hit;
    let id = s.blocks.get(h.q + ',' + h.r + ',' + h.y);
    // (le plateau d'un wagon plat n'est pas un bloc qu'on peut prendre)
    if (!BLOCKS[id] || BLOCKS[id].deck || BLOCKS[id].hidden && BLOCKS[id].pick === undefined) return;
    id = BLOCKS[id].pick ?? id;
    const i = hotbar.indexOf(id);
    if (i >= 0) { selectSlot(i); return; }
    hotbar[slot] = id;
    renderHotbar();
    selectSlot(slot);
    return;
  }
  if (targetCart) {
    // (une voiture de train : son objet ; un Hexacart : l'Hexacart)
    const item = targetCart.isTrain ? itemOfCar(targetCart) : HEXACART;
    const i = hotbar.indexOf(item);
    if (i >= 0) selectSlot(i); else { hotbar[slot] = item; renderHotbar(); selectSlot(slot); }
    return;
  }
  if (!target) return;
  // comme en créatif : le bloc visé va dans la barre s'il n'y est pas déjà
  let id = world.getBlock(target.hit.q, target.hit.r, target.hit.y);
  if (!BLOCKS[id]) return;
  id = BLOCKS[id].pick ?? id;
  const i = hotbar.indexOf(id);
  if (i >= 0) { selectSlot(i); return; }
  hotbar[slot] = id;
  renderHotbar();
  selectSlot(slot);
}

// Accès pour la console du navigateur (débogage)
// ---------- Profil de l'écran titre : pseudo et skin (voir skins.js, skinview.js) ----------
// Style des personnages : en hexagones, ou en pavés comme dans Minecraft (réglage dans l'écran
// Compte) : l'aperçu de l'écran titre, son personnage en jeu (et sa main), les autres joueurs
const skinStyle = () => (options.skinStyle === 'box' ? 'box' : 'hex');
const skinStyleBtn = document.getElementById('acc-skinstyle');
function renderSkinStyle() {
  skinStyleBtn.textContent = `Style des personnages : ${skinStyle() === 'box' ? 'Style Minecraft (pavés)' : 'Hexagones'}`;
}
skinStyleBtn.addEventListener('click', () => {
  options.skinStyle = skinStyle() === 'box' ? 'hex' : 'box';
  saveOptions();
  renderSkinStyle();
  setCharacterStyle(skinStyle());
  skinView.setSkin(skinUrl(options.skin), skinStyle());
  player.loadSkin(skinUrl(options.skin)).then(() => hand.setArm(player.parts?.armR));
  net.restyle();
});
renderSkinStyle();
skinView.setSkin(skinUrl(options.skin), skinStyle());
function renderProfile() {
  const name = document.getElementById('profile-name');
  name.textContent = options.pseudo;
  name.style.color = COLORS[account.color]?.[1] || '#fff';
  const list = mySkins(), s = list.find((x) => x.file === options.skin) || list[0];
  document.getElementById('skin-name').textContent = list.length > 1 ? `${s.name} (${list.indexOf(s) + 1}/${list.length})` : s.name;
  document.getElementById('skin-prev').disabled = document.getElementById('skin-next').disabled = list.length < 2;
}
// Skins qu'on peut choisir : les skins réservées seulement avec le compte qui les a obtenues
function mySkins() { return skinsFor(account.loggedIn ? account.skins : null); }
function setSkin(file) {
  options.skin = file;
  saveOptions();
  skinView.setSkin(skinUrl(options.skin), skinStyle());
  // (la main en 1re personne reprend le bras de la nouvelle skin)
  player.loadSkin(skinUrl(options.skin)).then(() => hand.setArm(player.parts?.armR));
  renderProfile();
}
// (déconnecté, ou un autre compte : la skin réservée choisie revient à celle par défaut)
function checkSkin() {
  if (!mySkins().some((s) => s.file === options.skin)) setSkin(skins()[0].file);
}
function changeSkin(step) {
  const list = mySkins();
  const i = Math.max(0, list.findIndex((x) => x.file === options.skin));
  setSkin(list[(i + step + list.length) % list.length].file);
}
document.getElementById('skin-prev').addEventListener('click', () => changeSkin(-1));
document.getElementById('skin-next').addEventListener('click', () => changeSkin(1));
if (screen === 'title') { renderProfile(); skinView.start(); }

// ---------- Chat vocal (voir voice.js) ----------
// Micro allumé seulement pendant une partie en ligne ; éteint sinon (Windows ne l'indique plus)
const voiceHud = document.getElementById('voice-hud');
addEventListener('blur', () => { voice.ptt = false; });
function updateVoice() {
  const on = net.active && voice.mode > 0 && state !== 'menu';
  if (on && !voice.mic && !voice.starting && !voiceWarned) {
    voice.start().then((ok) => {
      if (!ok && !voiceWarned && voice.mode) { voiceWarned = true; toast(voice.error || 'Micro indisponible'); }
    });
  } else if (!on && voice.mic) voice.stop();
  if (!voice.mic) voice.ptt = false;
  voice.update(camera, net.remotes);
  // indicateur : on parle (ou micro coupé en appuyant sur B)
  const show = on && voice.mic && (voice.talking || (voice.mode === 1 && Controls.held(keys, 'voice')));
  voiceHud.hidden = !show;
  if (show) voiceHud.textContent = '🎤 Tu parles';
}

// ---------- Compte en ligne (voir account.js) ----------
let accountClock = 0;
let accSignup = false;
let accReset = false; // mot de passe oublié : code demandé, champs du code affichés
let accAdminReq = false, accAdminLoaded = false, accRankAsked = false; // (demande à un admin ; panneau admin, place au classement déjà demandés)
const accEl = (id) => document.getElementById('acc-' + id);
account.onUnlock = (a) => {
  toast(`Succès : ${a.name} (+${a.xp} XP)`);
  // (un niveau de plus avec ce succès : la fanfare et plus d'étincelles)
  const up = levelOf(account.profile.xp) > levelOf(account.profile.xp - a.xp);
  playSting(up ? 'levelup' : 'achievement');
  if (state !== 'menu') fx.sparkle(player.pos.x, player.pos.y + 0.2, player.pos.z, up);
  if (up) toast(`Niveau ${levelOf(account.profile.xp)} !`);
};
account.onChange = () => {
  // pseudo du compte : aussi celui du multijoueur
  if (account.loggedIn && NAME_RE.test(account.profile.pseudo) && options.pseudo !== account.profile.pseudo) {
    options.pseudo = account.profile.pseudo;
    saveOptions();
  }
  checkSkin();
  if (screen === 'account') renderAccount();
  if (screen === 'achievements') renderAchievements();
  if (screen === 'title') renderProfile();
};
account.resume();

function openAccount() {
  for (const k of ['status', 'collect-status', 'code-status']) setStatus(k, '');
  renderAccount();
  if (account.enabled && account.session && !account.loggedIn) {
    setStatus('status', 'Connexion…');
    account.load().then(() => setStatus('status', '')).catch((e) => { setStatus('status', e.message); renderAccount(); });
  } else if (account.loggedIn) account.load().catch(() => {});
}

function setStatus(id, text, ok = false) {
  const el = accEl(id);
  el.textContent = text;
  el.classList.toggle('ok', ok);
}

// Icônes d'une liste d'objets [id, nombre]
function itemIcons(list, size = 32) {
  const frag = document.createDocumentFragment();
  for (const [id, n] of list) {
    const d = document.createElement('div');
    d.className = 'acc-item';
    d.title = `${itemName(id)} x${n}`;
    d.style.width = d.style.height = size + 4 + 'px';
    d.appendChild(blockIcon(id, size));
    const b = document.createElement('b');
    b.textContent = n > 1 ? n : '';
    d.appendChild(b);
    frag.appendChild(d);
  }
  return frag;
}

function renderAccount() {
  accEl('off').hidden = account.enabled;
  accEl('login').hidden = !account.enabled || account.loggedIn;
  accEl('in').hidden = !account.loggedIn;
  if (!account.loggedIn) {
    accEl('pseudo-row').hidden = !accSignup;
    accEl('submit').textContent = accSignup ? 'Créer mon compte' : 'Se connecter';
    accEl('switch').textContent = accSignup ? 'J\'ai déjà un compte' : 'Créer un compte';
    accEl('forgot').hidden = accSignup;
    accEl('reset').hidden = accSignup || !accReset;
    accEl('adminreq').hidden = accSignup || !accAdminReq;
    accEl('reqcheck').hidden = !account.resetRequest;
    accEl('pass').autocomplete = accSignup ? 'new-password' : 'current-password';
    // (inscription : l'e-mail est facultatif ; connexion : le pseudo ou l'e-mail)
    accEl('email-label').textContent = accSignup ? 'Adresse e-mail (facultatif : pour retrouver ton mot de passe par e-mail)' : 'Pseudo ou adresse e-mail';
    accEl('email').autocomplete = accSignup ? 'email' : 'username';
    return;
  }
  // administrateur : les demandes de mot de passe ; ma place au classement
  accEl('admin').hidden = !account.isAdmin;
  if (account.isAdmin && !accAdminLoaded) { accAdminLoaded = true; loadAdminRequests(); }
  if (!accRankAsked) {
    accRankAsked = true;
    account.myRank().then((r) => { if (r?.rank) accEl('rank').textContent = `Classement mondial : ${r.rank}${r.rank === 1 ? 'er' : 'e'} sur ${r.total} joueurs`; }).catch(() => {});
  }
  const p = account.profile, lvl = levelOf(p.xp), a = xpFor(lvl), b = xpFor(lvl + 1);
  accEl('name').textContent = p.pseudo;
  accEl('name').style.color = COLORS[p.color]?.[1] || '#fff';
  accEl('level').textContent = `Niveau ${lvl}`;
  accEl('xp').style.width = `${Math.round(((p.xp - a) / (b - a)) * 100)}%`;
  accEl('xptext').textContent = `${p.xp} XP — encore ${b - p.xp} XP pour le niveau ${lvl + 1}`;
  // boîte à récompenses
  const rewards = account.rewards, box = accEl('rewards');
  box.textContent = rewards.length ? '' : 'Vide';
  box.appendChild(itemIcons(rewards));
  const canCollect = state !== 'menu' && survival.on;
  accEl('collect').disabled = !rewards.length || !canCollect;
  if (rewards.length && !canCollect) setStatus('collect-status', 'Les objets se récupèrent dans un monde en survie (menu du jeu > Compte).');
  // couleurs du pseudo
  const colors = accEl('colors');
  colors.textContent = '';
  COLORS.forEach(([name, hex, need], i) => {
    const btn = document.createElement('button');
    btn.textContent = lvl >= need ? name : `${name} (niv. ${need})`;
    btn.style.color = hex;
    btn.disabled = lvl < need;
    btn.classList.toggle('sel', p.color === i);
    btn.addEventListener('click', () => account.setColor(i).catch((e) => toast(e.message)));
    colors.appendChild(btn);
  });
  // succès : sur leur propre écran (bouton)
  accEl('achcount').textContent = `(${ACHIEVEMENTS.filter((x) => account.unlocked.has(x.id)).length} / ${ACHIEVEMENTS.length})`;
}

// ---------- Écran des succès (bouton « Succès » du compte) ----------
// Par catégorie ; en haut : combien sont obtenus, l'XP qu'ils ont rapporté, une barre
function renderAchievements() {
  const head = document.getElementById('ach-head'), list = document.getElementById('ach-list');
  const got = ACHIEVEMENTS.filter((x) => account.unlocked.has(x.id));
  const xpGot = got.reduce((n, x) => n + x.xp, 0), xpAll = ACHIEVEMENTS.reduce((n, x) => n + x.xp, 0);
  head.innerHTML = '';
  const line = document.createElement('div');
  line.textContent = account.loggedIn
    ? `${got.length} / ${ACHIEVEMENTS.length} succès — ${xpGot} / ${xpAll} XP — niveau ${account.level}`
    : "Connecte-toi (écran Compte) pour obtenir des succès et gagner de l'XP.";
  const bar = document.createElement('div');
  bar.className = 'ach-bar';
  bar.innerHTML = `<i style="width:${(got.length / ACHIEVEMENTS.length) * 100}%"></i>`;
  head.append(line, bar);
  list.innerHTML = '';
  ACH_CATS.forEach((cat, ci) => {
    const items = ACHIEVEMENTS.filter((x) => x.cat === ci);
    if (!items.length) return;
    const h = document.createElement('h4');
    h.className = 'acc-title';
    h.textContent = `${cat} (${items.filter((x) => account.unlocked.has(x.id)).length} / ${items.length})`;
    const grid = document.createElement('div');
    grid.className = 'acc-achs';
    for (const x of items) {
      const on = account.unlocked.has(x.id);
      const d = document.createElement('div');
      d.className = 'acc-ach' + (on ? ' on' : '');
      const t = document.createElement('b');
      t.textContent = (on ? '✓ ' : '') + x.name;
      const xp = document.createElement('span');
      xp.className = 'ach-xp';
      xp.textContent = `+${x.xp} XP`;
      d.append(t, x.desc, xp);
      grid.appendChild(d);
    }
    list.append(h, grid);
  });
}

// Bouton qui attend la réponse du serveur (désactivé pendant ce temps)
async function busy(btn, fn) {
  if (btn.disabled) return;
  btn.disabled = true;
  try { await fn(); } finally { btn.disabled = false; renderAccount(); }
}


accEl('switch').addEventListener('click', () => { accSignup = !accSignup; accAdminReq = false; setStatus('status', ''); renderAccount(); });
accEl('submit').addEventListener('click', () => busy(accEl('submit'), async () => {
  const email = accEl('email').value.trim(), pass = accEl('pass').value;
  if (!pass || (!accSignup && !email)) { setStatus('status', accSignup ? 'Choisis un pseudo et un mot de passe' : 'Entre ton pseudo (ou ton e-mail) et ton mot de passe'); return; }
  accAdminLoaded = accRankAsked = false;
  setStatus('status', accSignup ? 'Création du compte…' : 'Connexion…');
  try {
    if (accSignup) {
      const r = await account.signUp(email, pass, accEl('pseudo').value.trim());
      if (r === 'confirm') { accSignup = false; setStatus('status', 'Compte créé ! Clique sur le lien reçu par e-mail, puis connecte-toi ici.', true); return; }
    } else await account.logIn(email, pass);
    accEl('pass').value = '';
    setStatus('status', '');
    toast(`Connecté : ${account.profile.pseudo}`);
  } catch (e) { setStatus('status', e.message); }
}));
accEl('pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') accEl('submit').click(); });
// Mot de passe oublié : un code arrive par e-mail, on le tape ici avec le nouveau mot de passe
accEl('forgot').addEventListener('click', () => busy(accEl('forgot'), async () => {
  const email = accEl('email').value.trim();
  if (!email) { setStatus('status', 'Entre d\'abord ton pseudo ou ton adresse e-mail'); return; }
  if (!email.includes('@')) {
    // un pseudo : compte sans e-mail -> demande à un administrateur ; sinon, il faut l'e-mail
    try {
      const kind = await account.kindOf(email);
      if (!kind) { setStatus('status', `Aucun compte « ${email} »`); return; }
      if (kind === 'email') { setStatus('status', 'Ce compte a une adresse e-mail : entre-la à la place du pseudo pour recevoir un code'); return; }
      accAdminReq = true;
      accReset = false;
      setStatus('status', '');
    } catch (e) { setStatus('status', e.message); }
    return;
  }
  try {
    await account.recover(email);
    accReset = true;
    setStatus('status', "E-mail envoyé (si un compte existe avec cette adresse). Dans l'e-mail, fais un clic droit sur « Reset password » > Copier l'adresse du lien, et colle-la ci-dessus avec ton nouveau mot de passe. (Déjà cliqué ? Colle l'adresse de la page qui s'est ouverte.)", true);
  } catch (e) { setStatus('status', e.message); }
}));
accEl('reset-ok').addEventListener('click', () => busy(accEl('reset-ok'), async () => {
  const email = accEl('email').value.trim(), code = accEl('code').value.replace(/\s/g, ''), pass = accEl('newpass').value;
  if (!email) { setStatus('status', 'Entre ton adresse e-mail (celle du compte)'); return; }
  setStatus('status', 'Changement du mot de passe…');
  try {
    await account.resetPassword(email, code, pass);
    accReset = false;
    accEl('code').value = accEl('newpass').value = accEl('pass').value = '';
    setStatus('status', '');
    toast(`Mot de passe changé — connecté : ${account.profile.pseudo}`);
  } catch (e) { setStatus('status', e.message); }
}));
accEl('newpass').addEventListener('keydown', (e) => { if (e.key === 'Enter') accEl('reset-ok').click(); });
accEl('reqsend').addEventListener('click', () => busy(accEl('reqsend'), async () => {
  const pseudo = accEl('email').value.trim();
  try {
    await account.requestReset(pseudo, accEl('reqnote').value.trim());
    accAdminReq = false;
    accEl('reqnote').value = '';
    setStatus('status', 'Demande envoyée ! Un administrateur va la traiter. Reviens ici et clique « Où en est ma demande ? » pour recevoir ton mot de passe provisoire.', true);
  } catch (e) { setStatus('status', e.message); }
}));
accEl('reqcheck').addEventListener('click', () => busy(accEl('reqcheck'), async () => {
  const pseudo = account.resetRequest?.pseudo;
  try {
    const r = await account.resetStatus();
    if (!r || r.status === 'unknown') setStatus('status', 'Demande introuvable : envoie-en une nouvelle (Mot de passe oublié)');
    else if (r.status === 'open') setStatus('status', 'Ta demande attend encore un administrateur. Réessaie plus tard.');
    else if (r.status === 'refused') setStatus('status', 'Un administrateur a refusé ta demande.');
    else if (r.password) {
      accEl('email').value = pseudo || '';
      accEl('pass').value = r.password;
      setStatus('status', `Ton mot de passe provisoire : ${r.password} — connecte-toi (il est déjà rempli), puis change-le dans ton compte.`, true);
    } else setStatus('status', 'Ta demande a été acceptée, mais le mot de passe a déjà été affiché. Refais une demande si tu l\'as perdu.');
  } catch (e) { setStatus('status', e.message); }
}));
accEl('chpass-ok').addEventListener('click', () => busy(accEl('chpass-ok'), async () => {
  try {
    await account.changePassword(accEl('chpass').value);
    accEl('chpass').value = '';
    setStatus('chpass-status', 'Mot de passe changé ✓', true);
  } catch (e) { setStatus('chpass-status', e.message); }
}));
// Administration : les demandes de mot de passe des comptes sans e-mail
async function loadAdminRequests() {
  const list = accEl('admin-list');
  list.textContent = 'Chargement…';
  try {
    const reqs = await account.adminRequests();
    list.textContent = reqs.length ? '' : 'Aucune demande en attente.';
    for (const q of reqs) {
      const row = document.createElement('div');
      row.className = 'acc-req';
      const info = document.createElement('span');
      info.innerHTML = `<b>${esc(q.pseudo)}</b> <i>— ${new Date(q.created_at).toLocaleString()}</i><br>${esc(q.note || '(pas de message)')}`;
      const ok = document.createElement('button'), no = document.createElement('button');
      ok.textContent = 'Accepter';
      no.textContent = 'Refuser';
      ok.addEventListener('click', async () => {
        try { const pw = await account.adminReset(q.id, true); toast(`${q.pseudo} : mot de passe provisoire « ${pw} » (il le verra dans son jeu)`); } catch (e) { toast(e.message); }
        loadAdminRequests();
      });
      no.addEventListener('click', async () => { try { await account.adminReset(q.id, false); } catch (e) { toast(e.message); } loadAdminRequests(); });
      row.append(info, ok, no);
      list.appendChild(row);
    }
  } catch (e) { list.textContent = e.message; }
}
accEl('admin-refresh').addEventListener('click', loadAdminRequests);
// Classement mondial des succès
// ---------- Amis et clans (voir social.js) ----------
let socialBack = 'account';
const social = initSocial({
  account, toast, ask, COLORS,
  screen: () => screen,
  back: () => show(socialBack),
  // rejoindre le monde ouvert d'un ami : son code est connu (présence), pas besoin de le demander
  joinFriend(f) {
    show('multi');
    mpAddr.value = f.host_code;
    if (f.locked) { mpStatus.textContent = `Le monde de ${f.pseudo} a un mot de passe : entre-le, puis « Rejoindre le serveur »`; setTimeout(() => mpPass.focus(), 0); }
    else joinServer();
  },
});
const openSocial = (id) => { socialBack = screen || 'account'; show(id); };
accEl('friends').addEventListener('click', () => openSocial('friends'));
accEl('clan').addEventListener('click', () => openSocial('clan'));
document.getElementById('mp-friends-btn').addEventListener('click', () => openSocial('friends'));
// Écran Multijoueur : les mondes ouverts par mes amis (un clic pour les rejoindre)
async function renderFriendWorlds() {
  const el = document.getElementById('mp-friends');
  el.textContent = '';
  if (!account.loggedIn) return;
  try {
    const list = (await account.friends()).filter((f) => f.host_code);
    if (!list.length) return;
    const h = document.createElement('h4');
    h.className = 'sep';
    h.textContent = 'Mondes ouverts par tes amis';
    el.appendChild(h);
    for (const f of list) {
      const row = document.createElement('div');
      row.className = 'social-row hosting';
      const n = document.createElement('span');
      n.className = 'n';
      n.textContent = f.pseudo;
      n.style.color = COLORS[f.color]?.[1] || '#fff';
      const st = document.createElement('span');
      st.className = 'st';
      st.textContent = `« ${f.world || 'son monde'} »${f.locked ? ' (mot de passe)' : ''}`;
      const b = document.createElement('button');
      b.className = 'acc-small go';
      b.textContent = 'Rejoindre';
      b.addEventListener('click', () => {
        mpAddr.value = f.host_code;
        if (f.locked && !mpPass.value) { mpStatus.textContent = 'Ce monde a un mot de passe : entre-le, puis Rejoindre'; mpPass.focus(); } else joinServer();
      });
      if (f.clan_tag) row.append(tagEl(f.clan_tag, f.clan_color));
      row.append(n, st, b);
      el.appendChild(row);
    }
  } catch { /* base pas à jour, hors ligne */ }
}
// Présence : en ligne, et le code du monde ouvert en multijoueur (pour les amis), toutes les 45 s
function sendPresence() {
  if (!account.loggedIn) return;
  const code = net.isHost ? hostResult?.shortCode : null;
  account.ping(code, code ? current?.name || '' : null, code ? !!hostResult?.password : false).catch(() => {});
}
setInterval(() => { sendPresence(); account.flushStats(); }, 45000);
setTimeout(sendPresence, 3000);

// ---------- Classements : statistiques envoyées au compte (voir account.track) ----------
// (survie sans triche seulement, sauf le temps de jeu ; /voie : le monde ne compte plus)
const fairPlay = () => !account.blocked?.() && !current?.noRank;
let statClock = 0, playAcc = 0, survAcc = 0;
function statTick(dt) {
  if (!account.loggedIn || document.hidden) return;
  const inWorld = (current || online) && (state === 'playing' || state === 'inventory' || state === 'craft' || state === 'chat' || state === 'phys');
  if (inWorld) { playAcc += dt; if (survival.on && fairPlay()) survAcc += dt; }
  if ((statClock += dt) < 10) return;
  statClock = 0;
  if (playAcc >= 1) { const n = Math.floor(playAcc); playAcc -= n; account.track('play_time', n); }
  if (survAcc >= 1) {
    const n = Math.floor(survAcc);
    survAcc -= n;
    account.stats.survie = (Number(account.stats.survie) || 0) + n;
    account.saveStats();
    account.setSurvival(account.stats.survie);
  }
  railRecord();
}
// La plus longue voie ferrée du monde : le plus grand réseau d'un seul tenant (blocs de voie)
function railRecord() {
  if (!fairPlay() || net.isClient || !tracks.edges?.size) return;
  const parent = new Map();
  const find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
  for (const e of tracks.edges.values()) {
    for (const n of [e.a, e.b]) if (!parent.has(n.key)) parent.set(n.key, n.key);
    const a = find(e.a.key), b = find(e.b.key);
    if (a !== b) parent.set(a, b);
  }
  const len = new Map();
  for (const e of tracks.edges.values()) { if (e.t === 'x') continue; const r = find(e.a.key); len.set(r, (len.get(r) || 0) + e.L); }
  account.railRecord(Math.max(0, ...len.values()));
}

let rankBack = 'account';
accEl('ranking').addEventListener('click', () => { rankBack = screen || 'account'; show('ranking'); renderRanking(); });
// [catégorie, nom, format de la valeur]
const hm = (s) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` : `${Math.floor(s / 60)} min`);
const dist = (m) => (m >= 1000 ? (m / 1000).toFixed(m >= 100000 ? 0 : 1) + ' km' : m + ' m');
const RANK_CATS = [
  ['ach', 'Succès'], ['survival_now', 'Survie en cours', hm], ['survival_best', 'Record de survie', hm], ['play_time', 'Temps de jeu', hm],
  ['rail_best', 'Plus longue voie ferrée', (v) => v.toLocaleString('fr-FR') + ' blocs'], ['placed', 'Blocs posés', (v) => v.toLocaleString('fr-FR')],
  ['broken', 'Blocs cassés', (v) => v.toLocaleString('fr-FR')], ['train_m', 'Distance en train', dist], ['walk_m', 'Distance à pied', dist], ['clans', 'Clans'],
];
let rankCat = 'ach';
function renderRankTabs() {
  const el = document.getElementById('rank-tabs');
  el.textContent = '';
  for (const [k, name] of RANK_CATS) {
    const b = document.createElement('button');
    b.textContent = name;
    b.className = k === rankCat ? 'on' : '';
    b.addEventListener('click', () => { rankCat = k; renderRanking(); });
    el.appendChild(b);
  }
}
document.getElementById('rank-back').addEventListener('click', () => show(rankBack));
async function renderRanking() {
  const list = document.getElementById('rank-list'), me = document.getElementById('rank-me');
  renderRankTabs();
  list.textContent = 'Chargement…';
  me.textContent = '';
  if (!account.enabled) { list.textContent = 'Les comptes en ligne ne sont pas configurés.'; return; }
  if (rankCat !== 'ach') { renderStatRanking(list, me); return; }
  try {
    const rows = await account.leaderboard(100);
    list.textContent = '';
    const head = document.createElement('div');
    head.className = 'rank-row head';
    head.innerHTML = '<span>#</span><span>Joueur</span><span class="a">Succès</span><span class="x">XP</span>';
    list.appendChild(head);
    const mine = account.profile?.pseudo?.toLowerCase();
    for (const r of rows) {
      const d = document.createElement('div');
      d.className = 'rank-row' + (r.rank <= 3 ? ' top' + r.rank : '') + (mine && r.pseudo.toLowerCase() === mine ? ' me' : '');
      d.innerHTML = `<span class="r">${r.rank}</span><span class="n" style="color:${COLORS[r.color]?.[1] || '#fff'}">${esc(r.pseudo)} <small>niv. ${levelOf(r.xp)}</small></span><span class="a">${r.achievements} / ${ACHIEVEMENTS.length}</span><span class="x">${r.xp}</span>`;
      list.appendChild(d);
    }
    if (!rows.length) list.textContent = 'Personne pour l\'instant : sois le premier !';
    if (account.loggedIn) {
      const r = await account.myRank().catch(() => null);
      if (r?.rank) me.textContent = `Ta place : ${r.rank}${r.rank === 1 ? 'er' : 'e'} sur ${r.total} joueurs`;
    } else me.textContent = 'Connecte-toi pour apparaître au classement.';
  } catch (e) { list.textContent = e.message; }
}
// Classement d'une catégorie (voir RANK_CATS), ou des clans
async function renderStatRanking(list, me) {
  const cat = rankCat, def = RANK_CATS.find(([k]) => k === cat);
  try {
    const mine = account.profile?.pseudo?.toLowerCase();
    const head = document.createElement('div');
    head.className = 'rank-row head';
    if (cat === 'clans') {
      const rows = await account.clanBoard(100);
      if (cat !== rankCat) return;
      list.textContent = '';
      head.innerHTML = '<span>#</span><span>Clan</span><span class="a">Membres</span><span class="x">Succès</span>';
      list.appendChild(head);
      for (const r of rows) {
        const d = document.createElement('div');
        d.className = 'rank-row' + (r.rank <= 3 ? ' top' + r.rank : '') + (account.clan?.tag === r.tag ? ' me' : '');
        const n = document.createElement('span');
        n.className = 'n';
        n.append(bannerEl(r.banner, 16), ' ', tagEl(r.tag, r.color), ' ' + r.name);
        d.innerHTML = `<span class="r">${r.rank}</span>`;
        d.append(n);
        d.insertAdjacentHTML('beforeend', `<span class="a">${r.members}</span><span class="x">${r.achievements}</span>`);
        list.appendChild(d);
      }
      if (!rows.length) list.textContent = 'Aucun clan pour l\'instant : crée le premier (Compte > Clan) !';
      return;
    }
    const rows = await account.statBoard(cat, 100);
    if (cat !== rankCat) return;
    list.textContent = '';
    head.innerHTML = `<span>#</span><span>Joueur</span><span class="a"></span><span class="x">${esc(def[1])}</span>`;
    list.appendChild(head);
    for (const r of rows) {
      const d = document.createElement('div');
      d.className = 'rank-row' + (r.rank <= 3 ? ' top' + r.rank : '') + (mine && r.pseudo.toLowerCase() === mine ? ' me' : '');
      d.innerHTML = `<span class="r">${r.rank}</span>`;
      const n = document.createElement('span');
      n.className = 'n';
      if (r.clan_tag) n.append(tagEl(r.clan_tag, r.clan_color), ' ');
      const p = document.createElement('span');
      p.textContent = r.pseudo;
      p.style.color = COLORS[r.color]?.[1] || '#fff';
      n.append(p);
      d.append(n);
      d.insertAdjacentHTML('beforeend', `<span class="a"></span><span class="x">${esc(def[2](Number(r.value)))}</span>`);
      list.appendChild(d);
    }
    if (!rows.length) list.textContent = 'Personne pour l\'instant : sois le premier ! (en survie, sans triche)';
    if (account.loggedIn) {
      const r = await account.myStatRank(cat).catch(() => null);
      if (r?.rank) me.textContent = `Ta place : ${r.rank}${r.rank === 1 ? 'er' : 'e'} sur ${r.total} joueurs — ${def[2](Number(r.value))}`;
      else me.textContent = 'Tes statistiques arrivent au classement toutes les minutes environ.';
    } else me.textContent = 'Connecte-toi pour apparaître au classement.';
  } catch (e) { list.textContent = e.message; }
}
accEl('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') accEl('reset-ok').click(); });
accEl('collect').addEventListener('click', () => {
  if (!survival.on || state === 'menu') return;
  const left = [], list = account.rewards, ids = list.map(([id]) => id);
  // (les objets reçus ne débloquent pas de succès : voir account.checkItems)
  account.hold = true;
  for (const [id, n] of list) {
    const rest = survival.give(id, n);
    if (rest > 0) left.push([id, rest]);
  }
  account.rewardedIn(survival.slots, ids);
  account.hold = false;
  account.rewards = left;
  renderAccount();
  setStatus('collect-status', left.length ? 'Inventaire plein : le reste attend dans la boîte.' : 'Objets ajoutés à ton inventaire !', !left.length);
});
accEl('redeem').addEventListener('click', () => busy(accEl('redeem'), async () => {
  const code = accEl('gift').value.trim();
  if (!code) return;
  try {
    const r = await account.redeem(code);
    accEl('gift').value = '';
    const got = r.skins.map((f) => skins().find((s) => s.file === f)).filter(Boolean);
    const what = [...r.items.map(([id, n]) => `${n} ${itemName(id)}`), ...(r.xp ? [`${r.xp} XP`] : []), ...got.map((s) => `la skin « ${s.name} »`)];
    setStatus('code-status', `Code validé : ${what.join(', ') || 'merci !'}${r.items.length ? ' (dans ta boîte à récompenses)' : ''}${got.length ? " — tu la portes déjà, et tu la retrouves sur l'écran titre" : ''}`, true);
    if (got.length) setSkin(got[0].file); // (on l'enfile tout de suite)
  } catch (e) { setStatus('code-status', e.message); }
}));
accEl('gift').addEventListener('keydown', (e) => { if (e.key === 'Enter') accEl('redeem').click(); });
accEl('logout').addEventListener('click', () => busy(accEl('logout'), async () => {
  if (!(await ask('Se déconnecter du compte ?', 'Se déconnecter'))) return;
  await account.logOut();
  accAdminLoaded = accRankAsked = false;
  accEl('rank').textContent = '';
}));

window.hexacraft = { account, ropes, animals, weather, tornadoes, sea, world, player, containers, circuits, nature, snowballs: () => snowballs, saveGame, breakBlock, placeBlock, updateTarget, selectSlot, playWorld, enterTitle, sky, renderer, camera, openInventory, carts, net, tnt, structs, items, hand, survival, setView: (m) => { viewMode = m; }, setTime: (t) => { dayTime = t; } };

// ---------- Lumière des torches ----------
// Les torches les plus proches (TORCH_LIGHTS au plus) éclairent vraiment la scène. Le nombre de
// lumières ne change jamais (pas de recompilation des shaders) : les inutilisées sont éteintes.
// Le nombre de lumières dépend de la qualité graphique (chacune se calcule pour chaque pixel).
let TORCH_LIGHTS = quality().torch;
const torchLights = Array.from({ length: 8 }, () => {
  const l = new THREE.PointLight(0xffa040, 0, 13, 1.6);
  l.castShadow = false;
  return l;
});
function applyTorchCount() {
  TORCH_LIGHTS = quality().torch;
  weather.density = quality().rain;
  torchLights.forEach((l, i) => { if (i < TORCH_LIGHTS) scene.add(l); else { scene.remove(l); l.intensity = 0; } });
  torchPick = 0;
}
let torchPick = 0, torchList = [];
// crépitement des torches : un seul son en boucle, plus fort près des torches (jusqu'à
// TORCH_HEAR blocs ; plusieurs torches proches s'additionnent)
const TORCH_HEAR = 9; // (le crépitement : fabriqué par le jeu, voir ambience.js)
let torchSound = null;
function updateTorchSound() {
  let level = 0;
  if (state !== 'menu') {
    const c = camera.position;
    for (const s of world.lightsNear(c.x, c.z, 16, TORCH_HEAR)) {
      if (s.kind !== 1) continue; // torches normales seulement (pas d'énergie, de lave...)
      const d = Math.hypot(s.x - c.x, s.y - c.y, s.z - c.z);
      if (d < TORCH_HEAR) level += (1 - d / TORCH_HEAR) ** 2;
    }
  }
  if (level > 0.01 && !torchSound) torchSound = fireSound();
  torchSound?.setLevel(Math.min(1, level));
}
applyTorchCount();
const flick = (t, seed) => Math.sin(t * 13.1 + seed * 7.3) * 0.5 + Math.sin(t * 7.7 + seed * 3.1) * 0.3 + Math.sin(t * 23.3 + seed) * 0.2;
function updateTorchLights(dt, t) {
  torchPick -= dt;
  if (torchPick <= 0) {
    torchPick = 0.25;
    updateTorchSound();
    torchList = state === 'menu' ? [] : world.lightsNear(player.pos.x, player.pos.z, TORCH_LIGHTS).concat(structs.lightsNear(player.pos.x, player.pos.z)).sort((a, b) => a.d2 - b.d2).slice(0, TORCH_LIGHTS);
  }
  // lumière des torches sur le terrain (propagée, voir light.js) : elle vacille un peu
  world.torchUniforms.uTorchScale.value = 1 + 0.06 * flick(t, 0.5);
  for (let i = 0; i < TORCH_LIGHTS; i++) {
    const l = torchLights[i], src = torchList[i];
    if (!src) { l.intensity = 0; continue; }
    // les torches ne se déplacent pas, mais une case peut avoir été cassée entre deux tris
    if (src.struct) structs.lightPos(src, l.position); else l.position.set(src.x, src.y, src.z);
    const f = flick(t, src.x * 0.37 + src.z * 0.61);
    if (src.kind === 2) {
      // torche d'énergie : rouge profond qui pulse lentement
      const pulse = 0.8 + 0.2 * Math.sin(t * 2.2 + src.x);
      l.color.setRGB(1, 0.1 + 0.05 * f, 0.06);
      l.intensity = 13 * pulse * (0.94 + 0.06 * f);
    } else if (src.kind === 4) {
      // lave : rouge orangé qui ondule lentement
      l.color.setRGB(1, 0.36 + 0.06 * f, 0.08);
      l.intensity = 10 * (0.85 + 0.15 * Math.sin(t * 1.3 + src.x));
    } else if (src.kind === 5) {
      // lampe de voltite : jaune chaud, sans vaciller
      l.color.setRGB(1, 0.8, 0.5);
      l.intensity = 15;
    } else if (src.kind === 3) {
      // four allumé : lueur orangée plus douce qu'une torche (le feu est dans le four)
      l.color.setRGB(1, 0.5 + 0.08 * f, 0.2);
      l.intensity = 6 * (0.85 + 0.15 * f);
    } else {
      // torche : orange qui tire vers le jaune quand la flamme monte
      l.color.setRGB(1, 0.58 + 0.1 * f, 0.22 + 0.06 * f);
      l.intensity = 14 * (0.85 + 0.15 * f);
    }
  }
  // la flamme des torches elles-mêmes vacille aussi
  world.glowMaterial.color.setScalar(1 + 0.08 * flick(t, 0));
}

// ---------- Boucle ----------
const clock = new THREE.Clock();
let fpsTime = 0, fpsFrames = 0, fps = 0;
let shadowTimer = 0;
const shadowCenter = new THREE.Vector3();
let lastShadowYaw = 0;

// Ciel + ombres puis rendu. La carte d'ombres n'est recalculée que si la lumière
// a bougé, qu'un chunk proche a changé, ou (30 fois/s max) si le personnage visible bouge.
const waterU = world.waterMaterial.uniforms;
const underwaterEl = document.getElementById('underwater');
const fogSave = { color: new THREE.Color(), near: 0, far: 0 };
const CAVE_FOG = new THREE.Color(0.012, 0.012, 0.016); // (le noir d'une grotte, voir render)
let caveDark = 0;
let waterTime = 0;
let waterClock = 0;
let lavaClock = 0;
const LAVA_TICK = 0.6; // la lave avance 3 fois moins vite que l'eau

// ---------- En feu, gelé ----------
// Effets par-dessus l'écran, joués depuis les GIF de texture/interface (voir overlays.js) :
// entrée (une fois), boucle tant que ça dure, sortie.
const fireFx = new OverlayFx(document.getElementById('fire'), {
  start: 'texture/interface/feu/ignite.gif', loop: 'texture/interface/feu/burning.gif', end: 'texture/interface/feu/extinguish.gif',
});
const frostFx = new OverlayFx(document.getElementById('frost'), {
  start: 'texture/interface/givre/freeze.gif', loop: 'texture/interface/givre/frozen.gif', end: 'texture/interface/givre/melt.gif',
});

// Dans la lave on brûle ; en survie, on reste en feu BURN_AFTER secondes après en être sorti
// (l'eau éteint).
const BURN_AFTER = 4;
let burnLeft = 0;
// Gel : dans l'eau glaciale, le froid monte (FREEZE_TIME s pour geler complètement) ; en
// survie, un demi-cœur toutes les FREEZE_HURT s une fois gelé. Hors de l'eau glaciale, on se
// réchauffe deux fois plus vite.
const FREEZE_TIME = 4, FREEZE_HURT = 1.5;
let cold = 0, frostHurt = 0, freezing = false;
function updateFrost(dt) {
  if (state === 'menu') { cold = 0; freezing = false; }
  else if (state === 'playing' || live()) {
    freezing = !player.fly && !survival.dead && player.touchesBlock(isIceWater);
    if (freezing) cold = Math.min(1, cold + dt / FREEZE_TIME);
    else cold = Math.max(0, cold - (2 * dt) / FREEZE_TIME);
    if (survival.on && cold >= 1) {
      frostHurt += dt;
      if (frostHurt >= FREEZE_HURT) { frostHurt = 0; survival.damage(1); }
    } else frostHurt = 0;
  }
  frostFx.update(freezing, dt);
}

// Chaleur : dans l'abîme, au-delà de HEAT_HURT °C, la chaleur brûle (en survie) ; d'autant plus
// vite qu'il fait chaud. L'eau rafraîchit.
const HEAT_HURT = 60;
let heatHurt = 0, heatWarned = false;
function updateHeat(dt) {
  const t = seasons.here ?? 0;
  if (!survival.on || survival.dead || player.fly || state === 'menu' || t < HEAT_HURT || player.touchesBlock(isWater)) {
    heatHurt = 0;
    if (t < HEAT_HURT - 8) heatWarned = false;
    return;
  }
  if (!heatWarned) { heatWarned = true; toast(`Il fait ${Math.round(t)} °C : la chaleur te brûle. Remonte, ou trouve de l'eau`); }
  heatHurt += dt;
  if (heatHurt >= Math.max(0.8, 4 - (t - HEAT_HURT) / 8)) { heatHurt = 0; survival.damage(1); }
}

// Air irrespirable (les autres planètes, voir system.js) : sans casque spatial, en survie, on
// étouffe (un demi-cœur toutes les 2 s). Dans le poste de pilotage, la fusée est étanche.
let airHurt = 0, airWarned = false;
const VOID_AIR = { name: "l'espace", atmo: { breath: false } };
// Une planète en rotation synchrone (Vesper) : tout dépend de l'endroit où l'on est
let climateHurt = 0, climateBand = null;
function updateClimate(dt) {
  const b = sky.planet;
  if (!b?.locked || flight.inVoid || state === 'menu') { climateBand = null; climateHurt = 0; return; }
  const e = sunElev(b, player.pos.x - flight.zone * ZONE, player.pos.z), t = localTemp(e), band = e > AIR_BAND ? 'hot' : e < -AIR_BAND ? 'cold' : 'ok';
  if (band !== climateBand) {
    climateBand = band;
    const air = b.atmo?.breath;
    toast(band === 'hot' ? `Face à ${sunOf(b).name} : ${Math.round(t)} °C${air ? ", l'air brûle" : ''}. Le crépuscule est vers la nuit` : band === 'cold' ? `La nuit éternelle : ${Math.round(t)} °C${air ? ", l'air gèle" : ''}. Le crépuscule est vers la lumière` : `Le crépuscule : ${Math.round(t)} °C${air ? ", l'air est respirable" : ', mais pas d\'air'}`);
  }
  if (band === 'ok' || !survival.on || survival.dead || player.fly || state !== 'playing' || (band === 'hot' && player.touchesBlock(isWater))) { climateHurt = 0; return; }
  climateHurt += dt;
  if (climateHurt >= Math.max(0.4, 3 - Math.abs(band === 'hot' ? t - 58 : t + 28) / 40)) { climateHurt = 0; survival.damage(1); }
}
function updateAir(dt) {
  updateClimate(dt);
  // (en haut d'une tour non plus ; à bord d'un train, la cabine est fermée)
  const thin = !player.riding && (flight.inVoid || (flight.on && player.pos.y > SPACE_Y));
  const P = thin ? VOID_AIR : sky.planet;
  const breath = P?.locked && !thin && P.atmo.breath ? Math.abs(sunElev(P, player.pos.x - flight.zone * ZONE, player.pos.z)) < AIR_BAND : P?.atmo.breath;
  if (!P || breath || !survival.on || survival.dead || state !== 'playing' || player.pilot || survival.head?.id === SPACE_HELMET || orbital.breathable()) { airHurt = 0; return; }
  if (!airWarned) { airWarned = true; toast(thin ? "Pas d'air dans l'espace : il te faut un casque spatial !" : 'Air irrespirable sur ' + P.name + ' : il te faut un casque spatial !'); }
  airHurt += dt;
  if (airHurt >= 2) { airHurt = 0; survival.damage(1); }
}

function updateFire(dt) {
  const inLava = state !== 'menu' && player.touchesBlock(isLava);
  if (state === 'playing' || live()) {
    // (créatif : un court instant, pour ne pas s'éteindre en flottant à la surface)
    if (inLava && !survival.dead) burnLeft = survival.on ? BURN_AFTER : 0.8;
    else burnLeft = Math.max(0, burnLeft - dt);
    if ((player.inWater && !inLava) || survival.dead) burnLeft = 0;
  }
  if (state === 'menu') burnLeft = 0;
  player.inLava = inLava;
  player.burning = burnLeft > 0;
  fireFx.update(player.burning, dt);
  // cœurs en feu, ou gelés (dans l'eau glaciale, ou tant qu'on n'est pas réchauffé)
  survival.setHeartStyle(player.burning ? 'burning' : freezing || cold > 0.25 ? 'frozen' : '');
}
const tmpColor = new THREE.Color();

// Succès vérifiés toutes les 2 s : distances (à pied, sur un objet physique), biomes traversés,
// vitesse et altitude sur un objet physique, villages visités, amis, collection
const hexDist = (dq, dr) => (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
const LAND_BIOMES = [BIOME.BEACH, BIOME.PLAINS, BIOME.FOREST, BIOME.MOUNTAIN, BIOME.DESERT, BIOME.SNOWY, BIOME.VOLCANO, BIOME.BIG_FOREST, BIOME.EURO_FOREST];
let achPos = null;
function checkAchievements() {
  const p = player.pos, s = player.standingOn;
  const step = achPos ? Math.hypot(p.x - achPos.x, p.z - achPos.z) : 0;
  achPos = { x: p.x, z: p.z };
  const playing = state === 'playing' && current;
  const onFoot = playing && survival.on && !player.riding && !player.fly && !s;
  const ph = worldToHex(p.x, p.z), biome = world.gen.v3 ? world.gen.biomeAt(ph.q, ph.r) : -1;
  // (au-delà de 120 blocs en 2 s : une téléportation, pas un voyage)
  if (step < 120) {
    if (onFoot && fairPlay()) account.track('walk_m', step);
    if (onFoot && account.bump('walk', step) >= 20000) account.unlock('marathon');
    if (playing && s && account.bump('structDist', step) >= 5000) account.unlock('long_courrier');
  }
  if (onFoot && biome >= 0) {
    if (biome === BIOME.VOLCANO) account.unlock('volcan');
    if (LAND_BIOMES.includes(biome)) {
      account.note('biomesFoot', biome);
      const n = LAND_BIOMES.filter((b) => account.noted('biomesFoot').includes(b)).length;
      if (n >= 5) account.unlock('globe');
      if (n >= LAND_BIOMES.length) account.unlock('biomes_pied');
    }
  }
  if (playing && s) {
    const v = s.vel.length();
    if (v > 1) account.unlock('embarque');
    if (v >= 25) account.unlock('bolide');
    if (p.y - world.surface(ph.q, ph.r).h >= 30) account.unlock('pilote');
    if (biome >= 0 && account.note('biomesObj', biome) >= BIOME_NAMES.length) account.unlock('biomes_objet');
  }
  if (survival.on && Math.hypot(p.x, p.z) >= 10000) account.unlock('tour_monde');
  // villageois amis tout autour
  let friends = 0;
  for (const a of animals.list) if (a.type === 'villager' && !a.dead && Math.hypot(a.pos.x - p.x, a.pos.z - p.z) < 64 && animals.talk.mood(a, options.pseudo) === 'friend') friends++;
  if (friends >= 10) account.unlock('heros');
  // villages proches (chez l'hôte : ce sont eux qui les connaissent)
  for (const V of animals.colony.villages.values()) {
    if (Math.hypot(V.x - p.x, V.z - p.z) > 120) continue;
    if (V.members.length >= 20) account.unlock('grand_village');
    if (V.wallR && animals.colony.wallComplete(V)) account.unlock('enceinte');
    const inside = (h, rad) => hexDist(ph.q - h.q, ph.r - h.r) <= rad && Math.abs(p.y - (h.y + 1)) < 1.5;
    if (V.houses.some((h) => h.kind === 'shop' && inside(h, 3))) account.unlock('client');
    if (V.barn && inside(V.barn, V.barn.rad - 1)) account.unlock('grange');
  }
  if (account.unlocked.size >= 40) account.unlock('collection');
}

// La musique (voir music.js) : thème du menu, puis en jeu un morceau de temps en temps (jour,
// nuit, grotte) ; les cinématiques choisissent la leur
let musicClock = 0;
function tuneMusic() {
  const cut = introOn || !!crashScene || document.body.classList.contains('cutscene');
  const { q, r } = worldToHex(player.pos.x, player.pos.z);
  const space = !!flight.inVoid;
  const cave = state !== 'menu' && !space && world.surface(q, r).h - player.pos.y > 10;
  // (en plein saut nédrolytique : aux commandes, ou passager du vaisseau qui saute)
  const jump = space && !!player.pilot?.s?.warp;
  const alien = !space && !!sky.planet && sky.planet.id !== 'hexa';
  musicDirector({ menu: state === 'menu', cutscene: cut, night: sky.daylight < 0.35, cave, jump, space, alien });
}
let gpuFence = null; // (FPS illimités : la dernière image envoyée à la carte graphique, voir frame)
function render(center, dt, moving) {
  // succès vérifiés de temps en temps (voir account.js)
  if (state !== 'menu' && account.loggedIn && (accountClock -= dt) <= 0) {
    accountClock = 2;
    const p = player.pos;
    if (survival.on && p.y >= 150) account.unlock('sommet');
    if (survival.on && p.y < 12 && state === 'playing') account.unlock('profondeurs');
    if (survival.on && p.y < -60 && state === 'playing') account.unlock('abysses');
    if (survival.on && Math.hypot(p.x, p.z) >= 2000) account.unlock('explorateur');
    if (player.riding) account.unlock('passager');
    if (net.active) account.unlock('multi');
    checkAchievements();
  }
  updateVoice();
  fx.update(dt);
  if (state === 'playing') animalCries(dt);
  if (state !== 'menu') stepTrackJob();
  if ((musicClock -= dt) <= 0) { musicClock = 1; tuneMusic(); }
  sky.alt = state === 'menu' ? 0 : player.pos.y; // (très haut : le ciel noircit)
  if (inTuto()) tutoSky();
  sky.update(dayTime, center, camera, dt);
  trains.night = 1 - sky.daylight;
  trains.view.copy(camera.position);
  updateDash(dt);
  trainTick(dt);
  // (dans l'espace : ni pluie, ni orage, ni tornade)
  weather.update(dt, sky.days, dayTime, camera, state !== 'menu' && !sky.space && !sky.planet, sky.daylight);
  seasons.update(dt, sky.days + dayTime, camera, sky.daylight, weather, state !== 'menu' && !sky.space);
  if ((state === 'playing' || live()) && !net.isClient && !sky.space) snowCover.update(dt, weather, net.isHost ? net.positions() : player.pos);
  sky.tilt = seasons.sunTilt();
  seasonTick();
  if (!sky.space) weather.applyToSky(sky);
  tornadoes.update(dt, sky.days + dayTime, camera, state !== 'menu' && !sky.space, state === 'playing' ? player : null, structs, !net.isClient, animals);

  // Réglages de l'eau (mêmes astres et même ciel que le reste de la scène)
  waterTime += dt;
  waterU.uTime.value = waterTime;
  // vagues de pleine mer : selon le temps qu'il fait ici (pluie, orage, ciel couvert, avec des
  // rafales), elles grossissent ou se calment en douceur (une minute environ)
  const here = weather.here, gust = 1 + 0.15 * Math.sin(waterTime * 0.21) * Math.sin(waterTime * 0.077);
  const rough = state === 'menu' ? 0.12 : Math.min(1, 0.1 + 0.3 * (here.rain || 0) + 0.7 * (here.storm || 0) + 0.12 * (here.cover || 0) ** 2) * gust;
  const seaTarget = WAVE_CALM + (WAVE_STORM - WAVE_CALM) * rough;
  sea.amp += (seaTarget - sea.amp) * (1 - Math.exp(-dt / 20));
  sea.t = waterTime;
  sea.dx = sky.clouds.wind.x; sea.dz = sky.clouds.wind.y;
  // mer croisée (chaotique) quand l'orage souffle ; tornades qui soulèvent l'eau
  const chaosTarget = state === 'menu' ? 0 : Math.min(1, 1.3 * (here.storm || 0) + Math.max(0, rough - 0.55) * 1.5);
  sea.chaos += (chaosTarget - sea.chaos) * (1 - Math.exp(-dt / 15));
  sea.tor = tornadoes.list.slice(0, MAX_TORNADOES).map((t) => ({ x: t.x, z: t.z, p: t.power }));
  waterU.uWaveAmp.value = sea.amp;
  waterU.uWaveDir.value.set(sea.dx, sea.dz);
  waterU.uChaos.value = sea.chaos;
  waterU.uTor.value.forEach((v, i) => { const t = sea.tor[i]; if (t) v.set(t.x - ORIGIN.x, t.z - ORIGIN.z, t.p); else v.set(0, 0, 0); }); // (près de l'origine flottante)
  waterU.uSunDir.value.copy(sky.light.position).sub(sky.light.target.position).normalize();
  // (l'eau ne reçoit pas les ombres : un nuage devant l'astre l'assombrit directement)
  waterU.uSunColor.value.copy(sky.light.color).multiplyScalar(sky.light.intensity * 0.6 * sky.clouds.shade);
  waterU.uAmbient.value.copy(sky.hemi.color).multiplyScalar(sky.hemi.intensity)
    .add(tmpColor.copy(sky.light.color).multiplyScalar(sky.light.intensity * 0.35));
  waterU.uSkyTop.value.copy(sky.uniforms.top.value);
  waterU.uSkyHorizon.value.copy(sky.uniforms.horizon.value);

  // Caméra sous l'eau : brouillard bleu court + teinte
  const ch = worldToHex(camera.position.x, camera.position.z);
  const camBlock = world.getBlock(ch.q, ch.r, Math.floor(camera.position.y + 0.12));
  const under = isWater(camBlock), iceUnder = isIceWater(camBlock);
  underwaterEl.classList.toggle('show', under);
  underwaterEl.classList.toggle('ice', iceUnder);
  // Caméra dans les profondeurs, sous la roche (ou sous la bedrock d'un ancien monde plat) : on
  // est dans une grotte. Le ciel disparaît, le lointain se perd dans le noir (et non plus dans le
  // bleu du ciel, au-delà du terrain dessiné).
  const inCave = !flight.inVoid && camera.position.y < 0 && world.surface(ch.q, ch.r).fh > camera.position.y + 2;
  caveDark += ((inCave ? 1 : 0) - caveDark) * Math.min(1, dt * 1.5);
  if (caveDark < 0.005) caveDark = 0;
  // vu de haut, le sol est loin sous la caméra : sa portée et le brouillard suivent l'altitude
  // (sinon le sol est coupé et l'on voit l'astre à travers)
  const altitude = flight.inVoid || state === 'menu' ? 0 : Math.max(0, camera.position.y - 64);
  const farNow = Math.ceil((baseFar + altitude) / 64) * 64;
  if (farNow !== camera.far) { camera.far = farNow; camera.updateProjectionMatrix(); }
  const haze = state !== 'menu' && !sky.space && !under ? weather.haze : 0; // (tempête de sable, cendres, déluge : voir weather.js)
  const fogged = under || caveDark > 0 || flight.inVoid || altitude > 32 || haze > 0.01;
  if (fogged) { fogSave.color.copy(scene.fog.color); fogSave.near = scene.fog.near; fogSave.far = scene.fog.far; }
  const skyShown = caveDark < 0.97;
  if (!skyShown) sky.group.visible = sky.dome.visible = sky.clouds.mesh.visible = false;
  if (caveDark > 0 && !under) {
    scene.fog.color.lerp(CAVE_FOG, caveDark);
  }
  if (haze > 0.01) {
    // (la couleur : voir weather.applyToSky) le brouillard se resserre
    scene.fog.far += (14 + 30 * (1 - haze) - scene.fog.far) * haze;
    scene.fog.near = Math.min(scene.fog.near, scene.fog.far * 0.3) * (1 - 0.7 * haze);
  }
  if (altitude > 32) { scene.fog.near += altitude; scene.fog.far += altitude; }
  // (dans l'espace : pas de brouillard, on voit loin)
  if (flight.inVoid && !under) { scene.fog.near = 1e6; scene.fog.far = 2e6; }
  if (under) {
    // (eau glaciale : plus claire)
    if (iceUnder) scene.fog.color.setRGB(0.18, 0.42, 0.55).multiplyScalar(0.3 + 0.7 * sky.daylight);
    else scene.fog.color.setRGB(0.02, 0.1, 0.2).multiplyScalar(0.3 + 0.7 * sky.daylight);
    scene.fog.near = 0;
    scene.fog.far = 16;
  }
  followOrigin(camera.position.x, camera.position.z);
  shadowTimer += dt;
  if (sky.needsShadow || ((moving || meshShadow) && shadowTimer > 1 / quality().shadowHz)) {
    renderer.shadowMap.needsUpdate = true;
    sky.needsShadow = false;
    meshShadow = false;
    shadowTimer = 0;
  }
  if (resPending) {
    resPending = false;
    applyPixelRatio();
  }
  updateFlare(dt);
  // le fond d'abord (ciel, puis astres), ensuite le monde par-dessus (sans refaire les matrices)
  renderer.clear();
  renderer.autoClear = false;
  camera.layers.set(SKY_LAYER);
  renderer.render(scene, camera);
  camera.layers.set(0);
  if (state !== 'menu' && skyShown) sky.view.render(renderer, camera);
  renderer.clearDepth();
  scene.matrixWorldAutoUpdate = false;
  renderer.render(scene, camera);
  scene.matrixWorldAutoUpdate = true;
  renderer.autoClear = true;
  if (photoShot) { photoShot(renderer.domElement); photoShot = null; } // (la vue, sans la main ni l'interface)
  if (nativeSettings?.unlimitedFps) { const gl = renderer.getContext(); gpuFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); }
  // (spectateur : pas de main, on ne fait que regarder)
  if (viewMode === 0 && state !== 'menu' && !player.riding && !crashScene?.active && !hideUi && !spectator) {
    hand.update(dt, hotbar[slot], {
      walk: player.walkPhase, speed: player.onGround ? Math.hypot(player.vel.x, player.vel.z) : 0,
      aspect: camera.aspect, light: sky.light, ambient: sky.hemi,
    });
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(hand.scene, hand.camera);
    renderer.autoClear = true;
  }
  if (fogged) {
    scene.fog.color.copy(fogSave.color); scene.fog.near = fogSave.near; scene.fog.far = fogSave.far;
  }
  if (!skyShown) { sky.group.visible = sky.dome.visible = true; sky.clouds.mesh.visible = !sky.space; }
}

let lastFrameAt = performance.now();

// ---------- Bruits de pas ----------
// Un pas à chaque foulée (au rythme du balancement des jambes), et un en retombant d'un saut ou
// d'une chute. Le son dépend du bloc sous les pieds : herbe, terre (et sable, gravier, neige,
// cendre), bois, métal (acier, blocs de fer, de platine et de tungstène, pas leurs minerais).
// Accroupi : plus doux. Rien en volant, en nageant ou à bord d'un véhicule.
const METAL_STEP = new Set([245, 246, 247, 62, 84, 86, 641, 643]);
function stepKind(id) {
  if (METAL_STEP.has(id)) return 'metal';
  if (id === 1 || id === 36) return 'herbe';
  const m = matterOf(id);
  if (m === 'wood') return 'bois';
  if (m === 'leaves') return 'herbe';
  if (m === 'dirt' || m === 'snow' || id === 244 || id === 69) return 'terre';
  return null;
}
let stepPhase = 0, wasOnGround = true, fallSpeed = 0, wasInWater = false;
function footsteps() {
  const p = player;
  const ok = p.onGround && !p.fly && !p.riding && !p.inWater;
  const under = () => {
    const { q, r } = worldToHex(p.pos.x, p.pos.z);
    let id = world.getBlock(q, r, Math.floor(p.pos.y - 0.05));
    if (!id || !SUPPORT[id]) id = world.getBlock(q, r, Math.floor(p.pos.y - 0.55)); // (une dalle, un bord)
    return stepKind(id);
  };
  const underId = () => {
    const { q, r } = worldToHex(p.pos.x, p.pos.z);
    const id = world.getBlock(q, r, Math.floor(p.pos.y - 0.05));
    return id && SUPPORT[id] ? id : world.getBlock(q, r, Math.floor(p.pos.y - 0.55));
  };
  // retombée : un pas plus appuyé (de haut : de la poussière)
  if (ok && !wasOnGround && fallSpeed > 4) {
    const k = under();
    if (k) playStep(k, Math.min(1.2, 0.6 + fallSpeed * 0.05));
    if (fallSpeed > 7) fx.dust(p.pos.x, p.pos.y, p.pos.z, Math.min(3, fallSpeed / 8), underId());
  }
  // on tombe dans l'eau : plouf
  if (p.inWater && !wasInWater && !p.fly && fallSpeed > 3) {
    const { q, r } = worldToHex(p.pos.x, p.pos.z);
    let top = Math.floor(p.pos.y + 0.6);
    while (isWater(world.getBlock(q, r, top + 1)) && top < p.pos.y + 4) top++;
    playSplash(fallSpeed / 10);
    fx.splash(p.pos.x, top + 0.9, p.pos.z, fallSpeed / 10);
  }
  wasInWater = p.inWater;
  wasOnGround = p.onGround;
  fallSpeed = p.onGround ? 0 : Math.max(fallSpeed, -p.vel.y);
  const n = Math.floor(p.walkPhase / Math.PI);
  if (n !== stepPhase) {
    stepPhase = n;
    if (ok && Math.hypot(p.vel.x, p.vel.z) > 0.6) {
      const k = under();
      if (k) playStep(k, p.sneak ? 0.35 : p.sprint ? 0.9 : 0.7);
      if (p.sprint) fx.dust(p.pos.x, p.pos.y, p.pos.z, 0.3, underId());
    }
  }
}

// L'éblouissement (voir lensflare.js) : l'étoile proche dans l'espace (selon l'éclat auquel l'œil
// s'est fait, voir skyview.js glare), le soleil d'Hexa au sol (plus doux, caché par les nuages).
// Un bloc entre l'œil et l'étoile la cache (les vitres non).
const lensFlare = new LensFlare(canvas);
const FLARE_GROUND = new THREE.Color(1, 0.95, 0.85);
function flareBlocked(dir) {
  const o = camera.position;
  for (let t = 0.6; t < 96; t += 0.45) {
    const y = o.y + dir.y * t;
    if (y < Y_MIN || y >= H) return false;
    const { q, r } = worldToHex(o.x + dir.x * t, o.z + dir.z * t);
    if (OPAQUE[world.getBlock(q, r, Math.floor(y))]) return true;
  }
  return false;
}
function updateFlare(dt) {
  let dir = null, k = 0, col = null;
  const cut = state === 'menu' || introOn || crashScene?.active || document.body.classList.contains('cutscene');
  if (!cut && sky.view?.on) {
    if (sky.space && sky.viewAt && sky.view.flareOn) { dir = sky.view.flareDir; k = sky.view.glare * 0.9; col = sky.view.flareColor; }
    else if (!sky.space && !sky.planet && sky.sunDir.y > -0.05) { dir = sky.sunDir; k = 0.4 * sky.daylight * (1 - (camera.position.y < CLOUD_Y ? sky.clouds.coverage : 0)) * (1 - (sky.eclipse || 0)); col = FLARE_GROUND; }
  }
  if (dir && k > 0.01 && flareBlocked(dir)) k = 0;
  lensFlare.update(camera, dir, k, col, dt);
}

function frame() {
  requestAnimationFrame(frame);
  // limite d'images : on attend l'heure de la prochaine (rattrapée si on a pris du retard ;
  // 3 ms de marge : sans elle, une image en avance d'un poil était sautée et on tombait à la
  // moitié de la limite)
  if (options.fpsCap && state !== 'loading') {
    const now = performance.now(), step = 1000 / options.fpsCap;
    if (now < nextFrameAt - 3) return;
    if (nextFrameAt < now - step) nextFrameAt = now;
    nextFrameAt += step;
  }
  // FPS illimités (sans synchro verticale) : la carte graphique n'a jamais plus d'une image en
  // retard. Sans ça, les images s'empilaient dans sa file : le compteur montait à 500 par seconde,
  // mais chacune s'affichait en retard (le jeu paraissait lent), et le thread principal, à fond,
  // prenait le processeur aux threads qui font le terrain.
  if (gpuFence) {
    const gl = renderer.getContext();
    // (jamais bloqué plus de 100 ms : contexte perdu, pilote capricieux)
    if (gl.clientWaitSync(gpuFence, 0, 0) === gl.TIMEOUT_EXPIRED && performance.now() - lastFrameAt < 100) return;
    gl.deleteSync(gpuFence);
    gpuFence = null;
  }
  lastFrameAt = performance.now();
  const dt = Math.min(clock.getDelta(), 0.1);
  pad.update(dt); // (manette : ses boutons et ses sticks, une fois par image)
  // lampe de casque portée : elle éclaire le terrain (voir world.js)
  world.torchUniforms.uLamp.value = state !== 'menu' && player.hat === HELMET_LAMP && !spectator ? 1 : 0;
  // (au chargement, l'écran est fixe : tout le terrain reçu passe d'un coup)
  world.uploadBudget = state === 'loading' ? 0 : quality().upload;
  if (state === 'loading') {
    // les threads génèrent les environs ; on entre dès que c'est prêt (6 s au plus)
    world.update(player.pos.x, player.pos.z, player.pos.y);
    if (world.isReady(player.pos.x, player.pos.z) || performance.now() - loadStart > 6000) finishLoading();
    return;
  }
  const inGame = state !== 'menu';
  if (!inGame && smogHaze.style.opacity !== '0') smogHaze.style.opacity = '0';
  if (touch.on) {
    touch.setActive(state === 'playing' && !document.body.classList.contains('cutscene'), state === 'inventory' || state === 'craft' || state === 'phys');
    touch.setPickLabel(player.riding?.kind === 'loco' || player.riding?.kind === 'tail' ? 'Train' : '◎');
  }
  if (state === 'playing' || state === 'menu' || live()) advanceTime(dt);

  if (state === 'menu') {
    // Panorama de l'écran titre
    panoAngle += dt * 0.04;
    camera.position.set(titleSpot.x, titleSpot.y, titleSpot.z);
    camera.rotation.set(-0.18, panoAngle, 0);
    world.update(titleSpot.x, titleSpot.z);
    render(titleSpot, dt, false);
    return;
  }

  // la faim (survie) : on court moins vite, puis plus du tout ; presque vide, la vue perd
  // ses couleurs (noir et blanc à zéro)
  player.sprintFactor = survival.sprintFactor();
  player.held = hotbar[slot]; // (les villageois voient ce qu'on tient : un cadeau ?)
  const sat = survival.colorFactor();
  const filter = sat < 0.999 ? `saturate(${sat.toFixed(3)})` : '';
  if (renderer.domElement.style.filter !== filter) renderer.domElement.style.filter = filter;
  if (sleep) tickSleep(dt);
  // (invité en ligne aussi : sans ça, sa carte de survie restait dans le brouillard)
  if ((current || net.isClient) && state !== 'menu') explore(dt);
  if (state === 'playing') {
    // (debout sur un tapis roulant : il nous emmène)
    // (en l'air, seulement à plat ou en descente : en montée, on buterait contre la rampe)
    const cv = !player.fly ? industry.carry(player.pos) : null;
    player.conveyor = cv && (player.onGround || !cv.up) ? cv : null;
    shipFrame ||= new ShipFrame({ structs, orbital, world, flight, survival: () => survival });
    shipFrame.check(player);
    (shipFrame.on ? (inp) => shipFrame.update(player, dt, inp) : (inp) => player.update(dt, inp))({
      forward: Controls.held(keys, 'forward') || keys.has('ArrowUp'),
      back: Controls.held(keys, 'back') || keys.has('ArrowDown'),
      left: Controls.held(keys, 'left') || keys.has('ArrowLeft'),
      right: Controls.held(keys, 'right') || keys.has('ArrowRight'),
      jump: Controls.held(keys, 'jump'),
      down: Controls.held(keys, 'down'),
      sprint: Controls.held(keys, 'sprint') || (touch.active && touch.sprint) || pad.sprint,
      // (joystick tactile, stick de la manette : la direction exacte, et à moitié poussé, on
      // marche moins vite)
      ax: touch.active ? touch.stick.x : pad.stick.x,
      az: touch.active ? touch.stick.z : pad.stick.z,
    });
    updateLook();
    updateTarget();
    radioTags.update(dt, camera.getWorldPosition(_radioEye), hideUi);
    updateGrab(dt);
    footsteps();
    // (touche de l'inventaire maintenue : collecte automatique des cartons)
    if (invKeyDown > 0 && performance.now() - invKeyDown >= INV_HOLD) { invKeyDown = -1; setAutoCollect(!autoCollect); }
    if (Controls.held(keys, 'drop') && dropNext && performance.now() >= dropNext) {
      dropHeld(keys.has('ControlLeft') || keys.has('ControlRight'));
      dropNext = performance.now() + DROP_EVERY;
    }

    breatheSmog(dt);
    if (survival.on) {
      survival.update(dt, player);
      if (mouse.left && !grab) mine(dt); else stopMining();
    }
    if ((mouse.left && !survival.on) || mouse.right) {
      mouse.cooldown -= dt;
      if (mouse.cooldown <= 0) {
        // colle et main gravitationnelle : un clic = une action (maintenu, l'objet serait
        // attrapé puis lâché en boucle)
        if (mouse.left) { if (!grab) breakBlock(); } else if (hotbar[slot] !== GLUE && hotbar[slot] !== DOUBLE_GLUE && hotbar[slot] !== ROPE && hotbar[slot] !== GRAVITY_HAND && hotbar[slot] !== SCHEMATIC) placeBlock();
        mouse.cooldown = 0.2;
      }
    }
  } else {
    player.animate(0);
  }
  // Fours : la cuisson continue aussi pendant que l'écran du four est ouvert
  if (inGame && (state === 'playing' || state === 'craft' || live()) && !net.isClient) {
    circuits.update();
    const moved = containers.update(dt);
    industry.update(dt);
    industry.animate(dt);
    if (survival.box) { if (moved.includes(survival.box)) survival.render(); else survival.renderProgress(); }
  } else if (inGame && net.isClient) industry.remoteTick(dt);
  // Simulation du monde : en solo seulement quand on joue (sauf en mode /afk) ; en ligne, elle
  // ne s'arrête pas (les autres joueurs continuent pendant qu'on est dans un menu)
  if (inGame && (state === 'playing' || live())) {
    const forward = state === 'playing' && (Controls.held(keys, 'forward') || keys.has('ArrowUp'));
    updateLook();
    carts.update(dt, player, { forward }, lookDir, net.proxies());
    if (!net.isClient) cartLoads.update();
    cartLoads.place();
    trains.update(dt, player, { forward, back: state === 'playing' && (Controls.held(keys, 'back') || keys.has('ArrowDown')) });
    cartons.update(dt, player, autoCollect && survival.on && state === 'playing', grabCarton);
    tnt.update(dt, { player, carts, listener });
    snowballs?.update(dt);
    weapons.update(dt);
    gunTick(dt);
    if (player.pilot && !player.pilot.passenger) { if (player.pilot.car) driveCar(); else pilotRocket(dt); }
    if (net.isHost) flight.hostPilots(dt);
    structs.update(dt, { player, others: net.proxies(), view: structView() });
    rockets.update(dt);
    if (player.pilot) seatPilot();
    ropes.update(dt, !net.isClient, ropeBodies());
    if (state === 'playing' && !player.pilot && !shipFrame?.on) structs.collidePlayer(player, dt);
    schem.update(dt, target?.prev || null, hotbar[slot] === SCHEMATIC);
    animals.update(dt, { players: [player, ...net.proxies()], view: Math.min(world.viewDistance, SIM_VIEW) });
    hexaliens.update(dt, player, camera);
    // Écoulement de l'eau : 5 pas par seconde (comme la vitesse de l'eau de Minecraft) — chez l'hôte
    if (!net.isClient) {
      nature.update(dt);
      waterClock += dt;
      if (waterClock >= 0.2) { waterClock = 0; world.tickWater(); }
      lavaClock += dt;
      if (lavaClock >= LAVA_TICK) { lavaClock = 0; world.tickLava(); }
    }
    if (net.active) net.update(dt, { forward, back: state === 'playing' && (Controls.held(keys, 'back') || keys.has('ArrowDown')) });
    if (performance.now() - lastSave > AUTOSAVE_MS) saveGame(false);
    flight.update(dt); // (l'espace, les zones de la carte : voir spaceflight.js)
    orbital.update(dt);
    orbital.tick(dt);
  }

  world.update(player.pos.x, player.pos.z, player.pos.y);
  updateFire(dt);
  updateFrost(dt);
  updateHeat(dt);
  updateAir(dt);

  // Caméra
  updateLook();
  player.model.visible = true;
  // (le corps : là où le joueur est maintenant ; il était placé avant que le vaisseau, l'objet ou la
  // bulle qui le portent avancent dans cette image, et traînait derrière eux, d'autant plus vite ils allaient)
  player.model.position.copy(player.pos);
  player.model.rotation.y = player.yaw;
  if (shipFrame?.on) shipFrame.place(player);
  // objet tenu : dans la main du personnage (3e personne), bras un peu levé
  const heldId = state === 'menu' ? 0 : hotbar[slot];
  if (player.parts) {
    items.attach(player.parts.armR, player.riding ? 0 : heldId);
    if (heldId && !player.riding) player.parts.armR.rotation.x = player.parts.armR.rotation.x * 0.4 - 0.35;
  }
  player.setFirstPerson(viewMode === 0);
  if (player.parts?.armR.userData.holder) player.parts.armR.userData.holder.visible = viewMode !== 0;
  if (viewMode === 0) {
    camera.position.copy(eye);
    if (shipFrame?.on) shipFrame.cameraQuat(player, camera.quaternion);
    else camera.rotation.set(player.pitch, player.yaw, 0);
  } else {
    // (dans un train : on tourne autour de la voiture, de plus loin, au-dessus de son toit)
    const car = player.riding?.isTrain ? player.riding : null, rk = player.pilot?.s;
    const from = car ? new THREE.Vector3(car.pos.x, car.pos.y + 4.6, car.pos.z) : rk ? rk.pos.clone() : eye, far = car ? 17 : rk ? rk.radius * 2.2 + 4 : 4;
    if (viewMode === 1) {
      const back = lookDir.clone().negate();
      camera.position.copy(from).addScaledVector(back, world.clearDistance(from, back, far));
      if (shipFrame?.on) shipFrame.cameraQuat(player, camera.quaternion);
      else camera.rotation.set(player.pitch, player.yaw, 0);
    } else {
      camera.position.copy(from).addScaledVector(lookDir, world.clearDistance(from, lookDir, far));
      camera.lookAt(from);
    }
  }

  if (crashScene?.active) { // (l'écrasement : la scène tient la caméra)
    crashScene.update(dt);
    crashScene.apply(camera);
    player.model.visible = false;
  }
  for (let i = pods.length - 1; i >= 0; i--) { pods[i].update(dt); if (!pods[i].active) pods.splice(i, 1); }
  listener.copy(eye);
  if (tnt.shake > 0) {
    const s = tnt.shake * 0.35;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.position.z += (Math.random() - 0.5) * s;
  }
  const turned = Math.abs(player.yaw - lastShadowYaw) > 0.03;
  // (un animal ou un villageois qui marche près du joueur : son ombre doit suivre)
  const moving = turned || carts.moving || net.moving || tnt.busy || structs.list.some((s) => s.moved) || Math.abs(player.vel.x) + Math.abs(player.vel.y) + Math.abs(player.vel.z) > 0.01 || animals.movingNear(player.pos, SHADOW_R);
  if (turned) lastShadowYaw = player.yaw;
  // zone d'ombres centrée au niveau du sol sous le joueur (même s'il vole haut)
  const ph = worldToHex(player.pos.x, player.pos.z);
  shadowCenter.set(player.pos.x, Math.min(player.pos.y, world.surface(ph.q, ph.r).h + 1), player.pos.z);
  // le tutoriel avance à chaque image, même inventaire ouvert (la scène, elle, n'est plus
  // redessinée tant qu'elle ne bouge pas, voir still)
  progress.update(dt);
  if (tutorial.on) {
    tutorial.update(dt);
    // tombé hors de la station : retour dans la cabine
    if (state === 'playing' && player.pos.y < STATION_Y - 30) { player.spawn(); player.yaw = -Math.PI / 2; toast("ORA t'a ramené dans ta cabine"); }
  }
  const still = !live() && (state === 'inventory' || state === 'craft');
  if (!still || !stillDrawn) {
    updateTorchLights(dt, clock.elapsedTime);
    render(shadowCenter, dt, moving);
  }
  stillDrawn = still;

  fpsFrames++;
  fpsTime += dt;
  if (fpsTime >= 0.5) { fps = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0; }
  autoResolution(dt);
  if (showDebug) {
    const lo = localOrigin(player.pos.x, player.pos.z), lx = player.pos.x - lo.x0, lz = player.pos.z - lo.z0;
    const h = worldToHex(lx, lz);
    debugEl.textContent =
      `HexaCraft ${GAME_VERSION} — ${fps} FPS — qualité ${quality().name}, rendu ${Math.round(renderer.getPixelRatio() * 100)} %\n` +
      (online ? `En ligne : partie de ${online.host} (${online.address || ''})\n` : `Monde : ${current?.name ?? '—'} (${current?.type === 'flat' ? 'plat' : 'normal'}, graine ${current?.seed ?? '—'})${net.isHost ? ` — serveur ouvert (${net.list.length} joueurs)` : ''}\n`) +
      `XYZ : ${lx.toFixed(2)} / ${player.pos.y.toFixed(2)} / ${lz.toFixed(2)}${lo.name ? `   (${lo.name})` : ''}\n` +
      `Hexa : q ${h.q}  r ${h.r}  y ${Math.floor(player.pos.y)}${world.gen.v3 && !lo.name ? `   Biome : ${BIOME_NAMES[world.gen.biomeAt(h.q, h.r)]}` : ''}\n` +
      `Heure : ${clockText(dayTime)}  (jour ${dayCount + 1}, ${MOON_PHASE_NAMES[sky.moonPhase]})   Saison : ${seasons.label()}, ${Math.round(seasons.here ?? 0)} °C   Chunks : ${world.chunks.size} complets + ${world.lods.size} simplifiés\n` +
      `Threads : ${world.threads || 'aucun (thread principal)'}   Tâches en cours : ${world.pendingJobs}\n` +
      `Animaux : ${animals.list.length} (${animals.drawn} affichés)   Objets collés : ${structs.list.length} (${structs.loadedCount} chargés)${structs.glued.size ? ` (${structs.glued.size} blocs collés en attente)` : ''}   Hexacarts : ${carts.carts.length}${player.riding ? `   (à bord, ${Math.abs(player.riding.v || player.riding.vel.length()).toFixed(1)} blocs/s)` : ''}\n` +
      `Au sol : ${player.onGround ? 'oui' : 'non'}   Vol : ${player.fly ? 'oui' : 'non'}\n` +
      (target ? `Visé : ${BLOCKS[world.getBlock(target.hit.q, target.hit.r, target.hit.y)].name} (${target.hit.q - lo.q0}, ${target.hit.r - lo.r0}, ${target.hit.y})` : 'Visé : —');
  }
}

// Fenêtre réduite : le navigateur n'affiche plus d'images, mais une partie en ligne doit
// continuer (l'hôte fait tourner le monde des autres), tout comme une partie en mode /afk :
// on simule sans dessiner.
setInterval(() => {
  if (!live() || state === 'menu' || state === 'loading' || performance.now() - lastFrameAt < 250) return;
  const dt = Math.min(clock.getDelta(), 0.1);
  advanceTime(dt);
  updateLook();
  carts.update(dt, player, { forward: false }, lookDir, net.proxies());
  if (!net.isClient) cartLoads.update();
  cartLoads.place();
  trains.update(dt, player, {});
  cartons.update(dt, player, false, grabCarton);
  tnt.update(dt, { player, carts, listener });
  structs.update(dt, { player, others: net.proxies(), view: structView() });
  animals.update(dt, { players: [player, ...net.proxies()], view: Math.min(world.viewDistance, SIM_VIEW) });
  if (!net.isClient) {
    nature.update(dt);
    circuits.update();
    containers.update(dt);
    industry.update(dt); // (fenêtre réduite : les usines tournent aussi)
    waterClock += dt;
    if (waterClock >= 0.2) { waterClock = 0; world.tickWater(); }
    lavaClock += dt;
    if (lavaClock >= LAVA_TICK) { lavaClock = 0; world.tickLava(); }
  }
  if (net.active) net.update(dt, { forward: false });
  if (performance.now() - lastSave > AUTOSAVE_MS) saveGame(false);
}, 50);

enterTitle();
frame();
// (le jeu est chargé : l'écran de démarrage peut s'effacer, voir index.html)
window.__hexaReady = true;
window.dispatchEvent(new Event('hexa-ready'));

// ---------- Mode film (?film) : vidéo de présentation, voir film/ (hors du jeu publié) ----------
// Le réalisateur (film/director.js) pilote la partie : il lit et modifie ce qu'il faut ici.
if (/[?&]film\b/.test(location.search)) {
  window.__filmScope = (src) => eval(src); // (eval direct : accès aux variables de ce module)
  // (?film=vertical : la vidéo verticale, voir film/vertical.js)
  import(/[?&]film=vertical/.test(location.search) ? '../film/vertical.js?v=1.1.5-alpha-mwgq2wrb' : '../film/director.js?v=1.1.5-alpha-mwgq2wrb').catch((e) => console.error('film', e));
}
