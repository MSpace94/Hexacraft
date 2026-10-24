// Trains : une locomotive et ses wagons, qui roulent sur les voies de train (voir tracks.js :
// des nœuds reliés par des lignes droites et de grands virages, façon Create). Chaque voiture fait 3 cases de long et repose sur deux bogies : chaque bogie
// suit la voie, la caisse va de l'un à l'autre (elle passe donc les virages en corde, comme un
// vrai train). Les voitures se suivent à distance fixe, derrière l'avant de la locomotive.
//  - poser : la locomotive sur un rail de train (dans le sens du regard), puis les wagons sur un
//    rail juste derrière le dernier véhicule (ils s'attellent tout seuls) ;
//  - clic droit sur la locomotive : monter dans la cabine ; Z avance, S freine puis recule,
//    clic gauche : le klaxon, H : le sifflet, P : le pilote automatique ; la touche pour descendre
//    (Maj) : descendre ;
//  - pilote automatique : le train garde sa vitesse (Z / S la changent), suit les aiguillages,
//    s'arrête 10 secondes à chaque gare (bloc « Gare » à côté de la voie), ralentit avant le bout
//    de la voie et derrière un autre train ; il continue sans conducteur ;
//  - en survie, la locomotive brûle du combustible (charbon, bois : clic droit dessus avec) ; plus
//    le train est long et chargé, moins il accélère et moins il va vite ;
//  - wagons : le wagon (un coffre de 30 cases) ; le wagon plat (son plateau est un objet physique
//    porté par le train, voir structs.js « kinematic » : on construit dessus, une base mobile) ; le
//    wagon trémie (il ramasse les objets tombés près de la voie, et se vide dans un coffre placé
//    sous les rails quand le train est arrêté) ; le wagon passagers (6 places assises, pour les
//    autres joueurs en ligne) ; le wagon poseur de rails (au bout de la voie, il pose la suite
//    devant le train, avec les rails et le gravier qu'on lui a donnés) ;
//  - collisions : deux trains qui se touchent s'arrêtent ; un train pousse les objets physiques
//    qu'il percute (et ralentit selon leur masse), un objet lancé contre un train arrêté rebondit ;
//  - effets : fumée de la locomotive (plus épaisse quand elle accélère), étincelles au freinage,
//    phares qui éclairent la voie la nuit, feu rouge à l'arrière du dernier wagon ;
//  - casser la locomotive : tout le train revient dans l'inventaire ; un wagon : lui seul.
// Le train ne déraille pas : au bout de la voie, il s'arrête (butoir).
// En ligne : l'hôte simule les trains et envoie leur état (state) ; un invité ne fait que les
// afficher (remote, applyState), conduit en envoyant ses touches, et demande à l'hôte de poser,
// casser, monter dans la cabine, basculer un aiguillage (voir net.js).
// Modèle : celui de train_hex (carrosserie jaune-or, jupe sombre, voyants orange), textures
// dessinées ici en 16 x 16.
import * as THREE from 'three';
import { worldToHex, hexToWorld, NEIGHBORS } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { SOLID, BLOCKS, ITEMS, makeSlot, compOf, DETECTOR, DETECTOR_ON } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { empty as emptyBox, CHEST_SLOTS } from './containers.js?v=1.1.5-alpha-mvm2b95g';
import { TRACK_IDS, isTrack } from './tracks.js?v=1.1.5-alpha-mvm2b95g';
import { DEPTH } from './gen.js?v=1.1.5-alpha-mvm2b95g';

export const LOCOMOTIVE = 457, WAGON = 458, FLAT_WAGON = 476;
// objet de chaque sorte de voiture
export const ITEM_OF = { loco: 457, wagon: 458, flat: 476, hopper: 490, passenger: 491, layer: 492, tail: 552, flat2: 553, tender: 583, covered: 591, armored: 592, mine: 663 };
export const KINDS = Object.keys(ITEM_OF);
const BOXED = new Set(['wagon', 'hopper', 'layer', 'tender', 'covered', 'mine']); // (les voitures avec un coffre)
// Wagon blindé : un tireur s'assoit sur la tourelle avant (clic droit) ; les deux tourelles
// suivent son regard, le clic gauche tire un obus (il explose comme une TNT là où il tombe)
export const SHELL = 594;
const SHELL_SPEED = 70, SHELL_G = 14, SHELL_LIFE = 6;
const GUN_X = 0.85, GUN_Y = 1.18; // (tourelle avant : sur le dessus du wagon, x en avant du milieu)
// Locomotives à vapeur (une autre apparence, et leur chaudière à la place d'un moteur) : la
// carénée (noire, profilée, bande rouge : rapide) et la camouflée (grandes roues rouges : elle
// tire fort, un train lourd la ralentit moins). Elles brûlent du charbon ou du bois ; le tender,
// attelé derrière, est un coffre de combustible qui remplit tout seul la chaudière
export const STYLES = {
  streamline: { item: 581, eng: { vmax: 36, acc: 0.9, burn: 1.25, power: 'steam' } },
  war: { item: 582, eng: { vmax: 25, acc: 1.35, burn: 1, power: 'steam', heavy: 0.75 } },
};
export const isSteam = (car) => !!STYLES[car?.style];
// La locomotive d'un train (pas forcément en tête : une rame peut être poussée), ou null : une
// rame dételée n'a pas de locomotive, elle roule sur son élan puis s'arrête
export const locoOf = (t) => t?.cars.find((c) => c.kind === 'loco') || null;
const _obs = new THREE.Vector3(); // (calculs : point de la voie devant un train)
const _place = Array.from({ length: 7 }, () => new THREE.Vector3()), _placeM = new THREE.Matrix4(); // (calculs : placeCars)
const DECK = 475;            // plateau du wagon plat (bloc)
const DECK_Y = 0.9;          // bas du plateau, au-dessus du rail
const CAR_MASS = 60000;      // masse d'une voiture (pour les chocs contre les objets)
// Le modèle est dessiné à l'échelle 1 (0,88 de large), puis agrandi de SC : le train fait 3 blocs
// de large, environ 10 cases de long par voiture et 4 blocs de haut (il est énorme)
const SC = 3 / 0.88;
const CAR_LEN = 3 * SC, GAP = 0.12 * SC, PITCH = CAR_LEN + GAP; // (longueur d'une voiture, attelage)
const BOGIE = 0.95 * SC;     // bogies à ±0,95 (× SC) du milieu de la voiture
const ROOF = 1.17 * SC, HALF_W = 0.44 * SC; // (hauteur du toit, demi-largeur)
const ACC = 3.2;             // accélération de la locomotive seule (blocs/s²)
const BRAKE = 9;             // freinage
const VMAX = 22, VBACK = 7;  // vitesse maximale en avant, en marche arrière (blocs/s)
const ROLL = 0.25, DRAG = 0.004, SLOPE = 6; // frottements ; gravité dans les pentes (un train est lourd)
// pilote automatique : freinage doux, arrêt en gare (la cabine en face de la gare), vitesse au
// bout de la voie quand le wagon poseur de rails la prolonge
const AUTO_BRAKE = 2.5, STOP_TIME = 10, CAB_OFF = CAR_LEN / 2 - 0.74 * SC, LAY_SPEED = 3.5;
// combustible de la locomotive (secondes de traction à pleine puissance, locomotive seule)
export const TRAIN_FUEL = { 104: 90, 323: 450, 5: 15, 97: 15, 152: 15, 256: 15, 18: 5, 99: 5, 154: 5, 258: 5 };
export const FUEL_MAX = 3600;
// moteur électrique : il se recharge avec de la voltite (voltite, voltite impure, bloc de voltite)
export const ELEC_FUEL = { 123: 120, 132: 60, 63: 1080 };
const fuelTable = (power) => (power === 'elec' ? ELEC_FUEL : power === 'none' ? {} : TRAIN_FUEL); // (vapeur : comme le thermique)
const STEAM_FUEL = Object.keys(TRAIN_FUEL).map(Number);
// moteur d'origine de la locomotive (sans moteur posé), et nombre d'emplacements de composants
const BASE_ENGINE = { vmax: 22, acc: 1, burn: 1, power: 'fuel' };
export const PART_SLOTS = 8;
const isDeckKind = (k) => k === 'flat' || k === 'flat2';
// places du wagon passagers (le long de la voiture, de côté), assis face à l'avant
const SEATS = [[-0.95, -0.22], [-0.95, 0.22], [0.02, -0.22], [0.02, 0.22], [0.98, -0.22], [0.98, 0.22]];
// ballast que le wagon poseur met sous un rail posé dans le vide (gravier, pierres, terre)
const BALLAST = [244, 28, 3, 29, 2];

// ---------- Textures (16 x 16, comme les blocs) ----------
const rngOf = (s) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
const pick = (r, a) => a[Math.floor(r() * a.length)];
function mk(seed, fn) {
  const r = rngOf(seed), c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  fn((x, y, col, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); }, r);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const noise = (p, r, cols) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p(x, y, pick(r, cols)); };
// texture dessinée librement (n x n pixels) : draw(g, r)
function canvasTex(seed, n, draw) {
  const r = rngOf(seed), c = document.createElement('canvas');
  c.width = c.height = n;
  draw(c.getContext('2d'), r);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Texture faite de petits hexagones (comme les icônes du jeu) : 64 x 64 pixels, 8 colonnes de
// cellules de 8 pixels, rangées décalées ; elle se raccorde sur les bords. colorAt(x, y, r) :
// la couleur de la cellule de centre (x, y)
function hexTex(seed, colorAt) {
  return canvasTex(seed, 64, (g, r) => {
    const W = 8, H = 8, hh = 16 / 3; // (pointe en haut : demi-hauteur 5,33, rangées tous les 8 pixels)
    for (let row = -1; row <= 8; row++) for (let col = -1; col <= 8; col++) {
      const cx = col * W + (row & 1 ? W / 2 : 0), cy = row * H;
      g.fillStyle = colorAt(((cx % 64) + 64) % 64, ((cy % 64) + 64) % 64, r);
      for (const dx of [0, 64, -64]) for (const dy of [0, 64, -64]) {
        const x = cx + dx, y = cy + dy;
        if (x < -8 || x > 72 || y < -8 || y > 72) continue;
        g.beginPath();
        g.moveTo(x, y - hh); g.lineTo(x + W / 2, y - hh / 2); g.lineTo(x + W / 2, y + hh / 2);
        g.lineTo(x, y + hh); g.lineTo(x - W / 2, y + hh / 2); g.lineTo(x - W / 2, y - hh / 2);
        g.closePath(); g.fill();
      }
    }
  });
}
// distance sur un tore de 64 (la texture se répète)
const torusD = (ax, ay, bx, by) => Math.hypot(Math.min(Math.abs(ax - bx), 64 - Math.abs(ax - bx)), Math.min(Math.abs(ay - by), 64 - Math.abs(ay - by)));
// camouflage : fond sable, grandes taches vertes, traînées gris-bleu, points bruns
function camo() {
  const r0 = rngOf(77), blobs = [];
  const add = (col, n, rmin, rmax) => { for (let i = 0; i < n; i++) blobs.push({ x: r0() * 64, y: r0() * 64, r: rmin + r0() * (rmax - rmin), col }); };
  add('#5e7f4f', 6, 7, 12);
  add('#4b6a42', 5, 4, 8);
  add('#3d4150', 3, 3, 5);
  add('#a3684a', 6, 1.5, 3);
  return hexTex(79, (x, y, r) => {
    let col = pick(r, ['#cdc795', '#c6c08b', '#d4cea0']);
    for (const b of blobs) if (torusD(x, y, b.x, b.y) < b.r) col = b.col;
    return col;
  });
}
// face d'une roue motrice, hexagonale : bandage, jante, rayons, moyeu, contrepoids (rouge)
function wheelFace() {
  return canvasTex(78, 32, (g) => {
    const hex = (rad, col) => { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; g[i ? 'lineTo' : 'moveTo'](16 + Math.cos(a) * rad, 16 + Math.sin(a) * rad); } g.closePath(); g.fill(); };
    g.fillStyle = '#5a2620'; g.fillRect(0, 0, 32, 32);
    hex(16, '#2b2c30');                                                         // bandage
    hex(13.5, '#8f3b2f');                                                       // jante
    hex(11, '#4a1d18');
    g.strokeStyle = '#a5483a'; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; g.beginPath(); g.moveTo(16, 16); g.lineTo(16 + Math.cos(a) * 11, 16 + Math.sin(a) * 11); g.stroke(); } // rayons
    g.fillStyle = '#7a3027'; g.beginPath(); g.moveTo(16, 16); g.lineTo(27, 16); g.lineTo(21.5, 25.5); g.closePath(); g.fill(); // contrepoids
    hex(3.2, '#b8bdc4');                                                        // moyeu
    g.fillStyle = '#e3b12a'; g.fillRect(20, 10, 3, 3);                          // maneton
  });
}
function materials() {
  const T = {
    coque: mk(1, (p, r) => { // coque jaune-or : joints, rivets, rayures
      noise(p, r, ['#d9a21b', '#d9a21b', '#cf981a', '#e0ab2a']);
      p(0, 0, '#7d560c', 16, 1); p(0, 1, '#f0c24d', 16, 1); p(0, 8, '#8f650f', 16, 1); p(0, 9, '#eab83c', 16, 1); p(0, 0, '#7d560c', 1, 16);
      for (const [x, y] of [[2, 3], [13, 3], [2, 12], [13, 12]]) { p(x, y, '#f6d878'); p(x + 1, y + 1, '#7d560c'); }
      for (let i = 0; i < 6; i++) p((r() * 16) | 0, (r() * 16) | 0, '#a8760f');
    }),
    metal: mk(2, (p, r) => { // métal sombre aéré
      noise(p, r, ['#2b2d31', '#2e3035', '#26282c']);
      p(0, 0, '#45484f', 16, 1); p(0, 15, '#161719', 16, 1);
      for (const y of [4, 6, 8, 10]) { p(3, y, '#121315', 10, 1); p(3, y + 1, '#3d4047', 10, 1); }
    }),
    toit: mk(3, (p, r) => { // toit nervuré
      noise(p, r, ['#383b41', '#3b3e44', '#34373c']);
      for (const x of [0, 5, 10]) { p(x, 0, '#1b1d20', 1, 16); p(x + 1, 0, '#54585f', 1, 16); }
    }),
    lampe: mk(4, (p) => { p(0, 0, '#3a1d06', 16, 16); p(1, 3, '#b45309', 14, 10); p(2, 4, '#ff8a1a', 12, 8); p(3, 5, '#ffc266', 10, 6); p(5, 7, '#fff0cc', 6, 2); }),
    vitre: mk(5, (p) => {
      p(0, 0, '#12304a', 16, 16);
      for (let i = 0; i < 16; i += 5) { p(i, 15 - i, '#4f8fbf', 3, 1); p(i + 1, 14 - i, '#2f6c99', 3, 1); }
      p(0, 0, '#0a1b2a', 16, 1); p(0, 15, '#0a1b2a', 16, 1);
    }),
    phare: mk(6, (p) => { p(0, 0, '#5a4a1a', 16, 16); p(2, 2, '#ffd66b', 12, 12); p(4, 4, '#fff6d0', 8, 8); }),
    danger: mk(7, (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p(x, y, ((x + y) >> 2) & 1 ? '#17181a' : '#e3b12a'); }),
    acier: mk(8, (p, r) => {
      noise(p, r, ['#4a4d54', '#44474d', '#50535a']);
      p(0, 0, '#2a2c30', 16, 1); p(0, 8, '#33363b', 16, 1); p(7, 0, '#2a2c30', 2, 16);
    }),
    banquette: mk(9, (p, r) => { // velours bordeaux des banquettes, coutures
      noise(p, r, ['#7a1f2b', '#83232f', '#721c27']);
      for (const x of [0, 8]) p(x, 0, '#4d1018', 1, 16);
      p(0, 15, '#4d1018', 16, 1);
    }),
    charge: mk(10, (p, r) => noise(p, r, ['#6d6a66', '#7d7a75', '#5e5b57', '#8a8682', '#56534f'])), // tas dans la trémie
    poli: mk(11, (p, r) => { noise(p, r, ['#9aa3ad', '#a3acb6', '#929ba5']); p(0, 0, '#d9e0e8', 16, 3); p(0, 13, '#5d646d', 16, 3); }), // rails empilés
    traverse: mk(12, (p, r) => { noise(p, r, ['#4a3523', '#553d28', '#43301f']); p(0, 0, '#2b1e13', 16, 1); }), // traverses empilées
    // vapeur : noir brillant riveté, rouge du châssis, charbon
    noir: hexTex(13, (x, y, r) => pick(r, ['#1b1c21', '#1e1f24', '#18191d', '#1b1c21', '#24262c'])),
    rouge: hexTex(14, (x, y, r) => pick(r, ['#8a3a2f', '#82352b', '#923f33', '#8a3a2f'])),
    charbon: hexTex(15, (x, y, r) => pick(r, ['#1b1b1d', '#26262a', '#111113', '#34343a', '#202024'])),
  };
  T.camo = camo();
  T.vert = hexTex(16, (x, y, r) => pick(r, ['#66753f', '#6d7c45', '#5f6e3b', '#717f4a']));
  T.vertFonce = hexTex(17, (x, y, r) => pick(r, ['#4c5a2f', '#526034', '#47552b']));
  T.roue = wheelFace();
  // voyants, phares et vitres : sans éclairage, ils brillent aussi la nuit
  const M = {};
  for (const k in T) {
    const glow = k === 'lampe' || k === 'phare' || k === 'vitre';
    M[k] = glow ? new THREE.MeshBasicMaterial({ map: T[k] }) : new THREE.MeshLambertMaterial({ map: T[k] });
  }
  // vitres : on voit au travers (depuis la cabine) ; parois de la cabine : visibles des deux côtés
  M.vitre = new THREE.MeshBasicMaterial({ map: T.vitre, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  M.coque2 = new THREE.MeshLambertMaterial({ map: T.coque, side: THREE.DoubleSide });
  M.metal2 = new THREE.MeshLambertMaterial({ map: T.metal, side: THREE.DoubleSide });
  // vapeur : la carénée est d'un noir brillant (reflets), ses lignes rouge et blanche
  M.noir = new THREE.MeshPhongMaterial({ map: T.noir, shininess: 70, specular: 0x5a5a5a });
  M.noir2 = new THREE.MeshPhongMaterial({ map: T.noir, shininess: 70, specular: 0x5a5a5a, side: THREE.DoubleSide });
  M.ligne = new THREE.MeshLambertMaterial({ color: 0xb02a55 });
  M.blanc = new THREE.MeshLambertMaterial({ color: 0xd7dce3 });
  M.camo2 = new THREE.MeshLambertMaterial({ map: T.camo, side: THREE.DoubleSide });
  M.rouge2 = new THREE.MeshLambertMaterial({ color: 0x5e2a22 });
  M.roue = [M.rouge, new THREE.MeshLambertMaterial({ map: T.roue }), new THREE.MeshLambertMaterial({ map: T.roue })];
  // feu rouge arrière, et son halo ; faisceau des phares (additifs : ils s'ajoutent à la lumière)
  M.feu = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const halo = document.createElement('canvas');
  halo.width = halo.height = 64;
  const hg = halo.getContext('2d'), grad = hg.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.5)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  hg.fillStyle = grad;
  hg.fillRect(0, 0, 64, 64);
  M.halo = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(halo), color: 0xff3020, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  M.beam = new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  return M;
}

// ---------- Modèles ----------
// Avant de la voiture : +X ; origine : le dessus du rail, au milieu de la voiture
function builders(M) {
  const geoCache = new Map();
  function box(g, w, h, d, m, x, y, z, raw = false) {
    const k = [w, h, d, raw].join(',');
    let geo = geoCache.get(k);
    if (!geo) {
      geo = new THREE.BoxGeometry(w, h, d);
      // (texture répétée : environ 16 pixels par bloc, comme les blocs)
      if (!raw) {
        const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
        for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const j = f * 4 + i; uv.setXY(j, uv.getX(j) * dims[f][0], uv.getY(j) * dims[f][1]); }
      }
      geoCache.set(k, geo);
    }
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    g.add(o);
    return o;
  }
  const wheelGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.07, 10).rotateX(Math.PI / 2);
  function bogie(g, x) {
    box(g, 0.9, 0.1, 0.56, M.acier, x, 0.2, 0);
    for (const dx of [-0.28, 0.28]) {
      for (const s of [-1, 1]) { const w = new THREE.Mesh(wheelGeo, M.acier); w.position.set(x + dx, 0.16, s * 0.33); g.add(w); }
      box(g, 0.05, 0.05, 0.66, M.acier, x + dx, 0.16, 0);
    }
  }
  // groupes de 3 fentes orange lumineuses sur la jupe, des deux côtés
  const lamps = (g, xs, y0) => { for (const x of xs) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) box(g, 0.34, 0.035, 0.02, M.lampe, x, y0 + i * 0.055, s * 0.42, true); };
  function chassis(g) {
    box(g, 3.0, 0.1, 0.7, M.metal, 0, 0.3, 0);
    bogie(g, -0.95); bogie(g, 0.95);
    box(g, 2.9, 0.2, 0.82, M.metal, 0, 0.45, 0);
    for (const x of [1.6, -1.6]) box(g, 0.2, 0.08, 0.14, M.acier, x, 0.34, 0); // attelages
  }
  // paroi plane (x de x0 à x1, y de y0 à y1) percée de fenêtres (rectangles [xa, ya, xb, yb]),
  // avec leurs vitres, à la profondeur z
  function wall(g, x0, x1, y0, y1, holes, z, m = M.coque2) {
    const shape = new THREE.Shape();
    [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    for (const [xa, ya, xb, yb] of holes) {
      const h = new THREE.Path();
      [[xa, ya], [xa, yb], [xb, yb], [xb, ya]].forEach(([x, y], i) => (i ? h.lineTo(x, y) : h.moveTo(x, y)));
      shape.holes.push(h);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa, yb - ya), M.vitre);
      glass.position.set((xa + xb) / 2, (ya + yb) / 2, z + Math.sign(z) * 0.002);
      g.add(glass);
    }
    const w = new THREE.Mesh(new THREE.ShapeGeometry(shape), m);
    w.position.z = z;
    w.castShadow = true;
    g.add(w);
  }
  function cab(g) {
    // cabine creuse (on s'y assoit pour conduire) : nez plein, parois percées de fenêtres,
    // pare-brise incliné et vitres transparentes, plancher, siège et pupitre
    const nose = new THREE.Shape();
    [[1.2, 0.55], [1.5, 0.55], [1.5, 0.75], [1.2, 0.8]].forEach(([x, y], i) => (i ? nose.lineTo(x, y) : nose.moveTo(x, y)));
    const noseM = new THREE.Mesh(new THREE.ExtrudeGeometry(nose, { depth: 0.84, bevelEnabled: false }).translate(0, 0, -0.42), M.coque);
    noseM.castShadow = true;
    g.add(noseM);
    for (const s of [-1, 1]) {
      const side = new THREE.Shape();
      [[0.5, 0.55], [1.2, 0.55], [1.2, 0.8], [0.95, 1.15], [0.5, 1.15]].forEach(([x, y], i) => (i ? side.lineTo(x, y) : side.moveTo(x, y)));
      const hole = new THREE.Path();
      [[0.56, 0.84], [0.56, 1.07], [0.92, 1.07], [1.03, 0.84]].forEach(([x, y], i) => (i ? hole.lineTo(x, y) : hole.moveTo(x, y)));
      side.holes.push(hole);
      const w = new THREE.Mesh(new THREE.ShapeGeometry(side), M.coque2);
      w.position.z = s * 0.42;
      w.castShadow = true;
      g.add(w);
      const glass = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(hole.getPoints())), M.vitre);
      glass.position.z = s * 0.421;
      g.add(glass);
      box(g, 0.5, 0.04, 0.02, M.metal, 0.75, 0.66, s * 0.43);
    }
    box(g, 0.02, 0.6, 0.84, M.coque2, 0.51, 0.85, 0);                       // paroi arrière
    box(g, 0.7, 0.02, 0.82, M.metal, 0.85, 0.565, 0);                       // plancher
    box(g, 0.47, 0.03, 0.84, M.coque2, 0.735, 1.15, 0);                     // toit
    box(g, 0.55, 0.04, 0.72, M.toit, 0.72, 1.18, 0);                        // plaque du toit
    const ws = box(g, 0.43, 0.01, 0.82, M.vitre, 1.075, 0.975, 0, true);    // pare-brise
    ws.rotation.z = -Math.atan2(0.35, 0.25);
    ws.castShadow = false;
    box(g, 0.1, 0.12, 0.6, M.metal, 1.13, 0.64, 0);                         // pupitre
    for (const z of [-0.15, 0, 0.15]) box(g, 0.02, 0.025, 0.06, M.lampe, 1.08, 0.7, z, true); // voyants du pupitre
    box(g, 0.2, 0.1, 0.28, M.metal, 0.72, 0.62, 0);                         // siège
    box(g, 0.04, 0.22, 0.28, M.metal, 0.61, 0.76, 0);                       // dossier
    box(g, 0.1, 0.14, 0.86, M.danger, 1.53, 0.45, 0);                       // pare-chocs
    box(g, 0.02, 0.1, 0.3, M.metal, 1.505, 0.66, 0);                        // calandre
    for (const s of [-1, 1]) box(g, 0.03, 0.1, 0.12, M.phare, 1.505, 0.66, s * 0.28, true); // phares
  }
  function loco() {
    const g = new THREE.Group();
    chassis(g);
    lamps(g, [-1.05, -0.35, 0.35], 0.4);
    box(g, 2.0, 0.5, 0.84, M.coque, -0.5, 0.8, 0);                          // capot
    box(g, 1.8, 0.03, 0.62, M.toit, -0.55, 1.065, 0);                       // plaque de toit
    for (const x of [-1.1, -0.6, -0.1]) box(g, 0.32, 0.06, 0.36, M.metal, x, 1.11, 0); // ventilateurs
    for (const x of [-1.1, -0.55, 0.0]) for (const s of [-1, 1]) box(g, 0.42, 0.26, 0.02, M.metal, x, 0.82, s * 0.425); // panneaux
    cab(g);
    // faisceau des phares (visible la nuit) : un cône qui part des phares vers l'avant
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.75, 3.2, 20, 1, true), M.beam.clone());
    beam.rotation.z = Math.PI / 2; // (la pointe vers l'arrière, contre les phares)
    beam.position.set(1.5 + 1.6, 0.6, 0);
    beam.castShadow = false;
    beam.renderOrder = 2;
    g.add(beam);
    g.userData.beam = beam;
    return g;
  }
  function wagon() {
    const g = new THREE.Group();
    chassis(g);
    lamps(g, [-1.05, -0.35, 0.35, 1.05], 0.4);
    box(g, 2.9, 0.5, 0.8, M.metal, 0, 0.8, 0);                              // caisse sombre
    for (let i = 0; i < 7; i++) box(g, 0.08, 0.5, 0.86, M.coque, -1.45 + i * 0.4833, 0.8, 0); // montants
    box(g, 3.0, 0.08, 0.88, M.coque, 0, 1.09, 0);                           // cadre haut
    box(g, 2.8, 0.03, 0.7, M.toit, 0, 1.14, 0);                             // trappe de toit
    for (const x of [-1.5, 1.5]) box(g, 0.06, 0.55, 0.88, M.coque, x, 0.82, 0); // extrémités
    for (const s of [-1, 1]) box(g, 2.7, 0.04, 0.02, M.coque, 0, 0.58, s * 0.43);
    return g;
  }
  // wagon plat : le châssis seul, des ranchets sur les côtés (le plateau est un objet physique)
  function flat() {
    const g = new THREE.Group();
    chassis(g);
    lamps(g, [-1.05, 1.05], 0.38);
    for (const x of [-1.3, -0.65, 0, 0.65, 1.3]) for (const sd of [-1, 1]) box(g, 0.06, 0.32, 0.06, M.coque, x, 0.68, sd * 0.43);
    return g;
  }
  // wagon trémie : une benne ouverte en entonnoir (parois inclinées), le tas qui monte dedans
  // selon le chargement, des trappes dessous, une échelle au bout
  function hopper() {
    const g = new THREE.Group();
    chassis(g);
    lamps(g, [-1.05, 1.05], 0.38);
    for (const s of [-1, 1]) {
      const w = box(g, 2.9, 0.6, 0.035, M.coque2, 0, 0.87, s * 0.37);
      w.rotation.x = s * 0.24;
      box(g, 3.0, 0.06, 0.06, M.metal, 0, 1.18, s * 0.44);                  // rebord
      for (const x of [-1.0, -0.33, 0.33, 1.0]) { const r = box(g, 0.06, 0.6, 0.02, M.metal, x, 0.87, s * 0.392); r.rotation.x = s * 0.24; } // raidisseurs
    }
    for (const x of [-1.46, 1.46]) box(g, 0.04, 0.62, 0.86, M.coque2, x, 0.88, 0); // bouts
    box(g, 2.86, 0.03, 0.58, M.metal, 0, 0.585, 0);                         // fond
    const loadGeo = new THREE.BoxGeometry(2.84, 1, 0.74).translate(0, 0.5, 0);
    const load = new THREE.Mesh(loadGeo, M.charge);
    load.position.y = 0.6;
    load.scale.y = 0.001;
    load.visible = false;
    g.add(load);
    g.userData.load = load;
    for (const x of [-0.3, 0.3]) { box(g, 0.32, 0.14, 0.38, M.acier, x, 0.39, 0); box(g, 0.34, 0.02, 0.4, M.danger, x, 0.31, 0); } // trappes
    for (const z of [-0.12, 0.12]) box(g, 0.02, 0.62, 0.02, M.acier, 1.5, 0.86, z); // échelle
    for (let i = 0; i < 5; i++) box(g, 0.02, 0.015, 0.24, M.acier, 1.5, 0.62 + i * 0.12, 0);
    return g;
  }
  // wagon passagers : voiture fermée, fenêtres, porte coulissante au milieu, banquettes, filets à
  // bagages, barres de maintien et plafonniers (allumés)
  function passenger() {
    const g = new THREE.Group();
    chassis(g);
    lamps(g, [-1.05, 1.05], 0.38);
    const wins = [[-1.36, 0.76, -0.95, 1.03], [-0.82, 0.76, -0.3, 1.03], [0.3, 0.76, 0.82, 1.03], [0.95, 0.76, 1.36, 1.03]];
    for (const s of [-1, 1]) {
      wall(g, -1.5, 1.5, 0.55, 1.14, wins, s * 0.42);
      box(g, 0.34, 0.5, 0.02, M.metal, 0, 0.83, s * 0.435);                 // porte coulissante
      box(g, 0.16, 0.18, 0.025, M.vitre, 0, 0.92, s * 0.436, true);          // (sa vitre)
      box(g, 0.36, 0.03, 0.09, M.acier, 0, 0.5, s * 0.47);                  // marchepied
      box(g, 3.0, 0.03, 0.03, M.metal, 0, 0.6, s * 0.43);                   // bandeau
      box(g, 2.6, 0.015, 0.1, M.acier, 0, 1.06, s * 0.35);                  // filet à bagages
    }
    for (const x of [-1.49, 1.49]) box(g, 0.03, 0.6, 0.84, M.coque2, x, 0.85, 0); // bouts
    box(g, 2.96, 0.02, 0.82, M.metal, 0, 0.565, 0);                         // plancher
    box(g, 3.04, 0.04, 0.9, M.toit, 0, 1.16, 0);                            // toit
    box(g, 2.9, 0.04, 0.6, M.toit, 0, 1.2, 0);
    box(g, 2.96, 0.01, 0.82, M.metal2, 0, 1.135, 0);                        // plafond
    for (const [x, z] of SEATS) {
      box(g, 0.2, 0.1, 0.3, M.banquette, x, 0.62, z);                       // siège
      box(g, 0.05, 0.24, 0.3, M.banquette, x - 0.11, 0.77, z);              // dossier
    }
    for (const x of [-0.47, 0.5]) box(g, 0.02, 0.57, 0.02, M.acier, x, 0.85, 0); // barres de maintien
    for (const x of [-1.0, 0, 1.0]) box(g, 0.34, 0.02, 0.1, M.lampe, x, 1.12, 0, true); // plafonniers
    return g;
  }
  // wagon poseur de rails : plateau chargé de rails et de traverses, pupitre, et à l'avant un bras
  // articulé qui pose la voie (il bouge quand il travaille)
  function layer() {
    const g = new THREE.Group();
    chassis(g);
    lamps(g, [-1.05, 1.05], 0.38);
    box(g, 2.9, 0.05, 0.84, M.acier, 0, 0.58, 0);                           // plateau
    for (const s of [-1, 1]) box(g, 2.9, 0.08, 0.03, M.coque, 0, 0.64, s * 0.42); // rebords
    for (let i = 0; i < 4; i++) for (const z of [-0.26, -0.16, 0.16, 0.26]) box(g, 1.7, 0.035, 0.05, M.poli, -0.55, 0.625 + i * 0.038, z); // rails empilés
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) box(g, 0.1, 0.05, 0.72, M.traverse, 0.55 + i * 0.12, 0.63 + j * 0.052, 0); // traverses
    box(g, 0.14, 0.32, 0.22, M.coque, -1.3, 0.76, 0.22);                    // pupitre
    box(g, 0.02, 0.12, 0.02, M.danger, -1.3, 0.97, 0.18);                   // levier
    for (const z of [-0.05, 0.05]) box(g, 0.02, 0.025, 0.04, M.lampe, -1.24, 0.88, 0.22 + z, true);
    box(g, 0.3, 0.12, 0.34, M.coque, 1.25, 0.66, 0);                        // base du bras
    const arm = new THREE.Group();
    arm.position.set(1.25, 0.74, 0);
    box(arm, 0.7, 0.07, 0.09, M.coque, 0.35, 0, 0);                         // bras
    const fore = new THREE.Group();
    fore.position.set(0.7, 0, 0);
    box(fore, 0.07, 0.45, 0.07, M.coque, 0, -0.22, 0);                      // avant-bras
    box(fore, 0.03, 0.03, 0.5, M.poli, 0, -0.45, 0);                        // le rail tenu (une traverse)
    arm.add(fore);
    const ram = box(g, 0.45, 0.035, 0.035, M.poli, 1.4, 0.7, 0.07);         // vérin
    ram.rotation.z = 0.5;
    g.add(arm);
    arm.rotation.z = 0.25;
    fore.rotation.z = -0.25;
    g.userData.arm = arm;
    g.userData.fore = fore;
    return g;
  }
  // feu rouge à l'arrière (montré sur le dernier véhicule du train) : deux lampes et leur halo
  function tail(g) {
    const t = new THREE.Group();
    for (const s of [-1, 1]) {
      box(t, 0.02, 0.06, 0.08, M.feu, -1.52, 0.62, s * 0.3, true);
      const h = new THREE.Sprite(M.halo);
      h.position.set(-1.56, 0.62, s * 0.3);
      h.scale.setScalar(0.35);
      t.add(h);
    }
    t.visible = false;
    g.add(t);
    g.userData.tail = t;
  }
  // wagon de queue : une caisse, et à l'arrière une cabine de conduite tournée vers l'arrière
  // (feux rouges à la place des phares, rétroviseurs)
  function tailCar() {
    const g = new THREE.Group();
    chassis(g);
    lamps(g, [0.35, 1.05], 0.4);
    box(g, 1.9, 0.5, 0.8, M.metal, 0.5, 0.8, 0);                            // caisse
    for (let i = 0; i < 5; i++) box(g, 0.08, 0.5, 0.86, M.coque, -0.42 + i * 0.475, 0.8, 0);
    box(g, 2.0, 0.08, 0.88, M.coque, 0.5, 1.09, 0);
    box(g, 1.8, 0.03, 0.7, M.toit, 0.5, 1.14, 0);
    box(g, 0.06, 0.55, 0.88, M.coque, 1.5, 0.82, 0);
    const c = new THREE.Group();
    cab(c);
    c.traverse((o) => { if (o.material === M.phare) o.material = M.feu; });
    for (const s of [-1, 1]) {
      box(c, 0.03, 0.07, 0.07, M.feu, 1.51, 0.95, s * 0.36, true);          // feux de toit
      box(c, 0.16, 0.02, 0.02, M.metal, 1.12, 0.98, s * 0.47);               // bras du rétroviseur
      box(c, 0.03, 0.12, 0.08, M.vitre, 1.2, 0.98, s * 0.53, true);          // rétroviseur
    }
    c.rotation.y = Math.PI;
    g.add(c);
    return g;
  }
  // ---------- Vapeur ----------
  // faisceau des phares (comme celui de la locomotive), au bout avant (x)
  function beamAt(g, x, y) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.75, 3.2, 20, 1, true), M.beam.clone());
    beam.rotation.z = Math.PI / 2;
    beam.position.set(x + 1.6, y, 0);
    beam.castShadow = false;
    beam.renderOrder = 2;
    g.add(beam);
    g.userData.beam = beam;
  }
  // prisme hexagonal (le jeu est fait d'hexagones) : axe x (à plat dessus), y ou z
  function cyl(g, r, len, m, x, y, z, axis = 'x', seg = 6) {
    const geo = new THREE.CylinderGeometry(r, r, len, seg);
    if (axis === 'x') geo.rotateZ(Math.PI / 2); else if (axis === 'z') geo.rotateX(Math.PI / 2);
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    g.add(o);
    return o;
  }
  // ligne peinte sur le nez hexagonal (à la hauteur y) : du flanc (z = ±side, en x = cx) aux
  // deux arêtes avant (rx, rz : demi-largeurs du nez à cette hauteur), en segments droits
  function noseLine(g, m, cx, y, rx, rz, side, th = 0.035) {
    const seg = (x1, z1, x2, z2) => {
      const L = Math.hypot(x2 - x1, z2 - z1), o = box(g, L, th, 0.012, m, (x1 + x2) / 2, y, (z1 + z2) / 2, true);
      o.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    };
    for (const s of [-1, 1]) {
      seg(cx, s * side, cx + 0.5 * rx + 0.004, s * (0.866 * rz + 0.006));
      seg(cx + 0.5 * rx + 0.004, s * (0.866 * rz + 0.006), cx + rx + 0.006, 0);
    }
  }
  // cabine de la vapeur, à l'arrière (de x = -1,5 à -0,72) : on y conduit debout, sur un plancher
  // surélevé ; fenêtres sur les côtés et devant, au-dessus de la chaudière ; porte du foyer
  // (lueur) et manomètres
  function steamCab(g, wallM, roofM, y0 = 0.55) {
    const wins = [[-1.42, 0.98, -1.16, 1.28], [-1.06, 0.98, -0.82, 1.28]];
    for (const s of [-1, 1]) wall(g, -1.5, -0.72, y0, 1.4, wins, s * 0.43, wallM);
    box(g, 0.02, 1.4 - y0, 0.86, wallM, -1.5, (1.4 + y0) / 2, 0);              // paroi arrière
    box(g, 0.03, 1.12 - y0, 0.86, wallM, -0.72, (1.12 + y0) / 2, 0);           // paroi avant (bas)
    box(g, 0.03, 0.08, 0.86, wallM, -0.72, 1.36, 0);                           // (haut)
    for (const z of [-0.4, 0, 0.4]) box(g, 0.03, 0.2, z ? 0.06 : 0.08, wallM, -0.72, 1.22, z); // montants
    for (const s of [-1, 1]) box(g, 0.01, 0.2, 0.32, M.vitre, -0.72, 1.22, s * 0.2, true); // vitres avant
    box(g, 0.76, 0.03, 0.82, M.metal, -1.11, 0.72, 0);                         // plancher
    box(g, 0.9, 0.04, 0.94, roofM, -1.11, 1.42, 0);                            // toit
    box(g, 0.02, 0.15, 0.22, M.lampe, -0.74, 0.84, 0, true);                   // porte du foyer (lueur)
    for (const z of [-0.16, 0.16]) box(g, 0.02, 0.06, 0.06, M.blanc, -0.74, 1.04, z, true); // manomètres
    box(g, 0.02, 0.03, 0.3, M.acier, -0.74, 0.96, 0);                          // régulateur
  }
  // locomotive carénée : tout en noir brillant, nez arrondi jusqu'aux rails, jupe qui cache les
  // roues, une ligne blanche qui plonge vers le nez, une bande rouge, le phare ovale cerclé de
  // blanc, deux écopes sur le dessus
  function streamline() {
    const g = new THREE.Group();
    bogie(g, -0.95); bogie(g, 0.95);
    box(g, 3.0, 0.1, 0.7, M.metal, 0, 0.3, 0);
    box(g, 1.77, 0.5, 0.86, M.noir, 0.165, 0.47, 0);                           // caisse (avant)
    box(g, 0.78, 0.33, 0.86, M.noir, -1.11, 0.385, 0);                         // jupe sous la cabine
    cyl(g, 0.43, 1.77, M.noir, 0.165, 0.75, 0);                                // dessus (prisme hexagonal)
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), M.noir);    // nez (hexagonal, pointe devant)
    nose.scale.set(0.45, 0.42, 0.43 / 0.866);
    nose.position.set(1.05, 0.7, 0);
    nose.castShadow = true;
    g.add(nose);
    box(g, 0.33, 0.2, 0.84, M.noir, 1.215, 0.22, 0);                           // tablier avant
    for (const s of [-1, 1]) {
      box(g, 2.55, 0.035, 0.012, M.ligne, -0.225, 0.47, s * 0.437, true);      // bande rouge
      box(g, 0.78, 0.03, 0.012, M.blanc, -1.11, 0.86, s * 0.437, true);        // ligne blanche (cabine)
      box(g, 1.27, 0.03, 0.012, M.blanc, -0.085, 0.86, s * 0.421, true);       // (le long du capot)
      const dip = box(g, 0.54, 0.03, 0.012, M.blanc, 0.8, 0.76, s * 0.433, true); // (elle plonge vers le nez)
      dip.rotation.z = -0.38;
      const ear = box(g, 0.42, 0.22, 0.035, M.noir2, 0.78, 1.22, s * 0.2);      // écopes
      ear.rotation.x = s * 0.3;
      cyl(g, 0.05, 0.1, M.acier, 1.4, 0.3, s * 0.3);                           // tampons
      cyl(g, 0.065, 0.02, M.noir, 1.45, 0.3, s * 0.3);
    }
    const f = (y) => 1 - (Math.abs(0.7 - y) / 0.297) * 0.293;
    noseLine(g, M.ligne, 1.05, 0.47, 0.45 * f(0.47), 0.4965 * f(0.47), 0.437);
    noseLine(g, M.blanc, 1.05, 0.66, 0.45 * f(0.66), 0.4965 * f(0.66), 0.432, 0.03);
    cyl(g, 0.055, 0.12, M.metal, 0.92, 1.16, 0, 'y');                         // cheminée
    box(g, 0.03, 0.1, 0.18, M.blanc, 1.05 + 0.45 * f(0.58) - 0.005, 0.58, 0, true); // phare cerclé de blanc
    box(g, 0.03, 0.065, 0.12, M.phare, 1.05 + 0.45 * f(0.58) + 0.002, 0.58, 0, true);
    steamCab(g, M.noir2, M.noir);
    beamAt(g, 1.5, 0.58);
    return g;
  }
  // locomotive camouflée : chaudière ronde peinte en camouflage, grandes roues rouges à rayons
  // (qui tournent, avec leur bielle), cadre rouge, cheminée, dômes, boîte à fumée à l'avant
  function war() {
    const g = new THREE.Group();
    box(g, 2.9, 0.05, 0.84, M.rouge, 0, 0.46, 0);                              // tablier
    box(g, 2.6, 0.22, 0.42, M.rouge2, 0.05, 0.3, 0);                           // longerons
    for (const x of [1.46, -1.46]) box(g, 0.08, 0.16, 0.86, M.rouge, x, 0.3, 0); // traverses de tête
    const wheels = [], rods = [], pistons = [];
    const R = 0.16, CRANK = 0.06;
    for (const s of [-1, 1]) {
      for (const x of [-0.66, -0.24, 0.18, 0.6]) wheels.push(cyl(g, R, 0.05, M.roue, x, R, s * 0.36, 'z')); // roues motrices (hexagonales)
      wheels.push(cyl(g, 0.09, 0.05, M.roue, 1.18, 0.09, s * 0.36, 'z'));      // roue avant
      wheels.push(cyl(g, 0.1, 0.05, M.roue, -1.18, 0.1, s * 0.36, 'z'));       // roue sous la cabine
      const rod = new THREE.Group();                                           // bielle d'accouplement
      box(rod, 1.32, 0.03, 0.02, M.acier, 0, 0, 0);
      rod.position.set(-0.03, R, s * 0.4);
      g.add(rod);
      rods.push(rod);
      const piston = box(g, 0.34, 0.02, 0.02, M.poli, 0.62, 0.3, s * 0.4);     // tige de piston
      pistons.push(piston);
      cyl(g, 0.1, 0.32, M.camo, 0.9, 0.3, s * 0.38);                           // cylindre (hexagonal)
      cyl(g, 0.045, 0.1, M.acier, 1.55, 0.3, s * 0.3);                         // tampons
      cyl(g, 0.06, 0.02, M.metal, 1.6, 0.3, s * 0.3);
      box(g, 1.8, 0.012, 0.012, M.acier, 0.19, 0.9, s * 0.245);                // main courante
      box(g, 0.025, 0.04, 0.05, M.phare, 1.5, 0.42, s * 0.26, true);           // lanternes
    }
    cyl(g, 0.27, 1.82, M.camo, 0.19, 0.755, 0);                                // chaudière (prisme hexagonal)
    cyl(g, 0.285, 0.28, M.camo, 1.24, 0.755, 0);                               // boîte à fumée
    cyl(g, 0.24, 0.02, M.metal, 1.385, 0.755, 0);                              // porte
    cyl(g, 0.065, 0.24, M.metal, 1.22, 1.1, 0, 'y');                           // cheminée
    cyl(g, 0.085, 0.03, M.metal, 1.22, 1.23, 0, 'y');
    for (const [x, r] of [[0.5, 0.09], [0.05, 0.08]]) {                        // dômes
      cyl(g, r, 0.12, M.camo, x, 1.04, 0, 'y');
      const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2), M.camo);
      cap.position.set(x, 1.1, 0);
      g.add(cap);
    }
    cyl(g, 0.025, 0.1, M.coque, -0.5, 1.03, 0, 'y');                           // sifflet (laiton)
    steamCab(g, M.camo2, M.camo, 0.48);
    beamAt(g, 1.5, 0.42);
    g.userData.wheels = wheels;
    g.userData.rods = rods;
    g.userData.pistons = pistons;
    g.userData.wheelR = R;
    g.userData.crank = CRANK;
    return g;
  }
  // tender : la réserve de combustible, derrière la locomotive à vapeur (même peinture qu'elle)
  function tender(style) {
    const g = new THREE.Group();
    if (style === 'streamline') {
      bogie(g, -0.95); bogie(g, 0.95);
      box(g, 3.0, 0.1, 0.7, M.metal, 0, 0.3, 0);
      box(g, 2.96, 0.5, 0.86, M.noir, 0, 0.47, 0);
      cyl(g, 0.43, 2.96, M.noir, 0, 0.75, 0);
      for (const s of [-1, 1]) {
        box(g, 2.96, 0.035, 0.012, M.ligne, 0, 0.47, s * 0.437, true);
        box(g, 2.96, 0.03, 0.012, M.blanc, 0, 0.86, s * 0.421, true);
      }
      box(g, 0.5, 0.03, 0.3, M.metal, 0.6, 1.18, 0);                           // trappe à eau
      return g;
    }
    box(g, 2.9, 0.06, 0.84, M.rouge, 0, 0.44, 0);                              // cadre
    box(g, 2.7, 0.2, 0.46, M.rouge2, 0, 0.3, 0);
    for (const s of [-1, 1]) for (const x of [-1.05, -0.72, 0.72, 1.05]) cyl(g, 0.11, 0.05, M.roue, x, 0.11, s * 0.36, 'z');
    for (const x of [-0.88, 0.88]) for (const s of [-1, 1]) box(g, 0.5, 0.08, 0.03, M.rouge, x, 0.2, s * 0.4); // flancs des bogies
    box(g, 2.8, 0.55, 0.84, M.camo, -0.05, 0.75, 0);                           // caisse
    box(g, 2.82, 0.04, 0.86, M.camo, -0.05, 1.04, 0);                          // rebord
    box(g, 2.0, 0.08, 0.7, M.charbon, 0.25, 1.08, 0);                          // charbon
    box(g, 1.3, 0.06, 0.48, M.charbon, 0.3, 1.14, 0);
    cyl(g, 0.12, 0.05, M.metal, -1.0, 1.06, 0, 'y');                           // trappe à eau
    for (const s of [-1, 1]) cyl(g, 0.045, 0.1, M.acier, -1.55, 0.3, s * 0.3);
    return g;
  }
  // wagon couvert : caisse vert olive, toit bombé (prisme hexagonal aplati), panneaux en croix,
  // porte coulissante au milieu, volant de frein jaune
  function covered() {
    const g = new THREE.Group();
    chassis(g);
    box(g, 2.9, 0.5, 0.84, M.vert, 0, 0.8, 0);                              // caisse
    const roof = cyl(g, 0.45, 2.98, M.vert, 0, 1.03, 0);                    // toit bombé
    roof.scale.y = 0.4;
    for (const s of [-1, 1]) {
      const z = s * 0.427;
      for (const x of [-1.2, -0.68, 0.68, 1.2]) {
        box(g, 0.035, 0.46, 0.02, M.vertFonce, x - 0.25, 0.8, z);            // montants
        for (const d of [-1, 1]) { const b = box(g, 0.62, 0.025, 0.02, M.vertFonce, x, 0.8, z); b.rotation.z = d * 0.7; } // croix
      }
      box(g, 0.035, 0.46, 0.02, M.vertFonce, 1.45, 0.8, z);
      box(g, 2.9, 0.035, 0.02, M.vertFonce, 0, 1.04, z);                     // cadre haut
      box(g, 2.9, 0.035, 0.02, M.vertFonce, 0, 0.57, z);                     // cadre bas
      box(g, 0.52, 0.46, 0.02, M.vertFonce, 0, 0.8, s * 0.433);              // porte coulissante
      box(g, 0.6, 0.025, 0.03, M.acier, 0, 1.06, s * 0.44);                 // son rail
      box(g, 0.2, 0.12, 0.012, M.blanc, -0.38, 0.92, s * 0.429, true);       // inscriptions
      box(g, 0.14, 0.08, 0.012, M.blanc, 0.38, 0.92, s * 0.429, true);
    }
    cyl(g, 0.07, 0.02, M.coque, 0.42, 0.4, 0.47, 'z');                       // volant de frein (jaune)
    box(g, 0.02, 0.18, 0.02, M.acier, 0.42, 0.48, 0.46);
    return g;
  }
  // wagon blindé : caisse en prisme hexagonal couchée (flancs en pointe, comme un blindage
  // incliné), jupe blindée sur les bogies, meurtrières, deux tourelles à canon qui tournent
  function armored() {
    const g = new THREE.Group();
    bogie(g, -0.95); bogie(g, 0.95);
    box(g, 3.0, 0.1, 0.7, M.metal, 0, 0.3, 0);
    cyl(g, 0.47, 2.9, M.camo, 0, 0.78, 0);                                   // caisse blindée
    box(g, 2.9, 0.3, 0.86, M.camo, 0, 0.42, 0);                              // jupe
    box(g, 2.96, 0.04, 0.88, M.metal, 0, 0.27, 0);
    for (const s of [-1, 1]) {
      for (const x of [-1.1, -0.45, 0.2, 0.85]) box(g, 0.22, 0.03, 0.02, M.metal, x, 0.88, s * 0.42); // meurtrières
      for (const x of [-1.45, 1.45]) cyl(g, 0.05, 0.1, M.acier, x + Math.sign(x) * 0.05, 0.34, s * 0.3); // tampons
    }
    const turrets = [];
    for (const [x, back] of [[GUN_X, 0], [-GUN_X, 1]]) {
      const t = new THREE.Group();
      t.position.set(x, GUN_Y, 0);
      cyl(t, 0.27, 0.22, M.camo, 0, 0.11, 0, 'y');                           // tourelle (hexagonale)
      cyl(t, 0.22, 0.03, M.metal, 0, 0.235, 0, 'y');                          // trappe
      const b = new THREE.Group();
      b.position.set(0.2, 0.11, 0);
      box(b, 0.12, 0.14, 0.2, M.camo, 0, 0, 0);                               // masque
      cyl(b, 0.035, 0.75, M.metal, 0.42, 0, 0);                              // canon
      cyl(b, 0.05, 0.07, M.metal, 0.8, 0, 0);                                // bouche
      t.add(b);
      t.rotation.y = back ? Math.PI : 0;
      g.add(t);
      turrets.push({ t, b, back });
    }
    g.userData.turrets = turrets;
    return g;
  }
  // wagonnet de mine : une benne basse en tôle rouillée, cerclée de fer, un tas de minerai dedans
  function mineCar() {
    const g = new THREE.Group();
    chassis(g);
    lamps(g, [-1.05, 1.05], 0.38);
    for (const sd of [-1, 1]) {
      const w = box(g, 2.6, 0.42, 0.035, M.coque2, 0, 0.8, sd * 0.36);
      w.rotation.x = sd * 0.16;
      box(g, 2.7, 0.05, 0.06, M.metal, 0, 1.02, sd * 0.4);                      // rebord
      for (const x of [-0.9, 0, 0.9]) box(g, 0.05, 0.44, 0.02, M.metal, x, 0.8, sd * 0.385); // cerclages
    }
    for (const x of [-1.32, 1.32]) box(g, 0.04, 0.44, 0.74, M.coque2, x, 0.8, 0);  // bouts
    box(g, 2.6, 0.03, 0.62, M.metal, 0, 0.6, 0);                                  // fond
    box(g, 2.3, 0.2, 0.56, M.charge, 0, 0.78, 0);                                 // le tas de minerai
    for (const [x, z] of [[-0.8, 0.05], [0.05, -0.08], [0.85, 0.06]]) box(g, 0.55, 0.2, 0.36, M.charge, x, 0.92, z);
    return g;
  }
  return { loco, wagon, flat, hopper, passenger, layer, tail: tailCar, flat2: flat, rearLight: tail, streamline, war, tender, covered, armored, mine: mineCar };
}

// Range une pile dans le coffre d'une voiture ; renvoie ce qui n'y tient pas (nombre)
export function putIn(box, st) {
  let n = st.n;
  const max = ITEMS[st.id]?.stack ?? 64;
  if (!st.w) for (const s of box.slots) {
    if (!s || s.id !== st.id || s.w || s.n >= max) continue;
    const k = Math.min(n, max - s.n);
    s.n += k; n -= k;
    if (!n) return 0;
  }
  for (let i = 0; i < box.slots.length && n > 0; i++) {
    if (box.slots[i]) continue;
    const k = st.w ? 1 : Math.min(n, max);
    box.slots[i] = makeSlot(st.id, k, st.w);
    n -= k;
  }
  return n;
}
// Prend un objet parmi ids dans le coffre ; renvoie son id, ou 0
function takeOne(box, ids) {
  for (let i = 0; i < box.slots.length; i++) {
    const s = box.slots[i];
    if (!s || !ids.includes(s.id)) continue;
    if (--s.n <= 0) box.slots[i] = null;
    return s.id;
  }
  return 0;
}
const count = (box, ids) => box.slots.reduce((n, s) => n + (s && ids.includes(s.id) ? s.n : 0), 0);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------- Les trains ----------
export class TrainSystem {
  constructor(scene, world, tracks, structs = null) {
    this.scene = scene;
    this.world = world;
    this.tracks = tracks;
    this.structs = structs; // (plateaux des wagons plats, chocs contre les objets)
    this.cartons = null;    // (objets tombés : ramassés par les wagons trémie, voir main.js)
    this.containers = null; // (coffres sous la voie : la trémie s'y vide)
    this.fuelOn = () => false; // (survie : la locomotive brûle du combustible)
    this.remote = false;    // (invité en ligne : les trains viennent de l'hôte)
    this.trains = [];
    this.nextId = 1;
    this.M = null;
    this.tmp = new THREE.Vector3();
    this.night = 0;         // (0 : plein jour, 1 : nuit noire ; voir main.js)
    this.view = new THREE.Vector3(); // (la caméra : les phares des trains les plus proches éclairent)
    this.onClack = null; // (passage d'une case à l'autre : bruit des roues, voir main.js)
    this.onHorn = null;
    // phares : deux lumières, toujours dans la scène (allumées sur les deux locomotives les plus
    // proches, la nuit), pour ne pas refaire les matériaux quand un train apparaît
    this.spots = [0, 1].map(() => {
      const l = new THREE.SpotLight(0xfff1c4, 0, 48, 0.42, 0.55, 1.1);
      l.castShadow = false;
      scene.add(l, l.target);
      return l;
    });
  }
  get cars() { return this.trains.flatMap((t) => t.cars); }

  model(kind, style = '') {
    this.M ||= materials();
    this.B ||= builders(this.M);
    // (posé sur le rail : les roues touchent la voie ; puis agrandi)
    const inner = kind === 'loco' && STYLES[style] ? this.B[style]() : kind === 'tender' ? this.B.tender(style) : (this.B[kind] || this.B.wagon)(), g = new THREE.Group();
    this.B.rearLight(inner);
    this.mergeStatic(inner, kind + '|' + style);
    inner.position.y = -0.06;
    g.add(inner);
    g.scale.setScalar(SC);
    g.userData = inner.userData;
    return g;
  }
  // Pièces fixes d'un modèle réunies en un maillage par matière : une voiture était faite de
  // dizaines de petites boîtes, autant d'appels de dessin (et pour les ombres) ; c'est maintenant
  // quelques-uns par voiture. Les pièces animées (celles de userData : roues, bielles, tourelles,
  // chargement, phares...) restent à part. Les maillages réunis sont faits une fois par sorte de
  // voiture et partagés.
  mergeStatic(inner, key) {
    const keep = new Set(), seen = new Set();
    const mark = (v) => {
      if (!v || typeof v !== 'object' || seen.has(v)) return;
      seen.add(v);
      if (v.isObject3D) { v.traverse((o) => keep.add(o)); return; }
      for (const x of Array.isArray(v) ? v : Object.values(v)) mark(x);
    };
    mark(inner.userData);
    // (les pièces à réunir : des maillages simples, sans pièce animée sur le chemin)
    const list = [];
    const walk = (o) => {
      for (const c of o.children) {
        if (keep.has(c)) continue;
        if (c.isMesh && !c.isInstancedMesh && !c.children.length && !Array.isArray(c.material) && c.visible && c.geometry.attributes.position) list.push(c);
        else if (!c.isMesh && !c.isLight) walk(c);
      }
    };
    walk(inner);
    if (list.length < 2) return;
    this.mergeCache ||= new Map();
    let merged = this.mergeCache.get(key);
    if (!merged) {
      inner.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(inner.matrixWorld).invert(), m = new THREE.Matrix4();
      const groups = new Map(); // matière + ombre -> pièces
      for (const o of list) {
        const k = o.material.uuid + (o.castShadow ? '+' : '-') + (o.receiveShadow ? '+' : '-');
        if (!groups.has(k)) groups.set(k, { mat: o.material, cast: o.castShadow, receive: o.receiveShadow, parts: [] });
        m.multiplyMatrices(inv, o.matrixWorld);
        const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(m);
        groups.get(k).parts.push(geo);
      }
      merged = [];
      for (const gr of groups.values()) {
        let n = 0;
        for (const g of gr.parts) n += g.attributes.position.count;
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
        let o3 = 0, o2 = 0;
        for (const g of gr.parts) {
          pos.set(g.attributes.position.array, o3);
          if (g.attributes.normal) nor.set(g.attributes.normal.array, o3);
          if (g.attributes.uv) uv.set(g.attributes.uv.array, o2);
          o3 += g.attributes.position.count * 3; o2 += g.attributes.position.count * 2;
          g.dispose();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        geo.computeBoundingSphere();
        merged.push({ geo, mat: gr.mat, cast: gr.cast, receive: gr.receive });
      }
      this.mergeCache.set(key, merged);
    }
    for (const o of list) o.parent.remove(o);
    for (const mg of merged) {
      const mesh = new THREE.Mesh(mg.geo, mg.mat);
      mesh.castShadow = mg.cast;
      mesh.receiveShadow = mg.receive;
      inner.add(mesh);
    }
  }
  // (deck, deckId : le plateau d'un wagon plat rechargé, et le numéro de son objet)
  // (style : celui d'une locomotive à vapeur ; le tender prend celui de sa locomotive)
  makeCar(train, kind, deck = null, deckId = 0, style = '') {
    style = kind === 'loco' && STYLES[style] ? style : kind === 'tender' ? (locoOf(train)?.style || 'war') : '';
    const car = {
      id: this.nextId++, kind, style, train, owner: this, isTrain: true, rider: null,
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0), v: 0,
      mesh: this.model(kind, style),
      box: BOXED.has(kind) ? emptyBox('chest') : null, // (le chargement du wagon)
      seats: kind === 'passenger' ? new Array(SEATS.length).fill(null) : null,
      fuel: kind === 'loco' ? 0 : undefined,
      comps: kind === 'loco' ? { engine: 0, parts: new Array(PART_SLOTS).fill(0) } : undefined,
    };
    this.scene.add(car.mesh);
    if (isDeckKind(kind) && this.structs) car.deck = this.makeDeck(car, deck, deckId);
    return car;
  }
  // Le plateau d'un wagon plat : un objet physique porté par le train. 3 rangées de cases sur la
  // longueur de la voiture, en plateau de wagon (incassable) ; ce qu'on construit dessus s'y ajoute
  makeDeck(car, list, id) {
    const S = this.structs;
    if (!Array.isArray(list) || !list.some((b) => b[3] === DECK)) {
      list = [];
      const cells = [];
      for (let r = -1; r <= 1; r++) {
        for (let q = Math.ceil(-4.6 - r / 2); q <= Math.floor(4.6 - r / 2); q++) { list.push([q, r, 0, DECK]); cells.push([q, r]); }
      }
      if (car.kind === 'flat2') {
        // à étage : un deuxième plateau 3 blocs plus haut (2 blocs sous plafond), un escalier sur un
        // côté (deux marches) avec sa trémie dans l'étage, des montants aux coins, un garde-corps
        const qMin = (r) => Math.ceil(-4.6 - r / 2), qMax = (r) => Math.floor(4.6 - r / 2);
        const stair = (q, r) => r === 1 && q <= qMin(1) + 1;
        list.push([qMin(1), 1, 1, DECK], [qMin(1) + 1, 1, 1, DECK], [qMin(1) + 1, 1, 2, DECK]);
        for (const [q, r] of cells) {
          if (!stair(q, r)) list.push([q, r, 3, DECK]);
          const edge = r !== 0 && (q === qMin(r) || q === qMax(r) || q === 0);
          if (edge && !stair(q, r)) list.push([q, r, 1, 579], [q, r, 2, 579]);
          if ((r !== 0 || q === qMin(r) || q === qMax(r)) && !stair(q, r) && !(r === 1 && q === qMin(1) + 2)) list.push([q, r, 4, 580]);
        }
      }
    }
    if (!(id > 0) || S.byId(id)) id = ++S.nextId;
    else S.nextId = Math.max(S.nextId, id);
    const d = S.create(id, car.pos.x, car.pos.y, car.pos.z, null, list);
    d.kinematic = true;
    d.carrier = car;
    return d;
  }
  // Place le plateau sur son wagon (appelé à chaque image : la physique ne le bouge pas)
  placeDeck(c) {
    const d = c.deck, S = this.structs;
    if (!d || !S.list.includes(d)) return;
    (d.kinPrevPos ||= new THREE.Vector3()).copy(d.pos);
    (d.kinPrevQuat ||= new THREE.Quaternion()).copy(d.quat);
    d.quat.copy(c.mesh.quaternion);
    const o = new THREE.Vector3(0, DECK_Y, 0).applyQuaternion(d.quat).add(c.pos);
    d.pos.copy(d.com).applyQuaternion(d.quat).add(o);
    d.vel.copy(c.vel);
    d.ang.set(0, 0, 0);
    S.updateFrame(d);
  }

  // ---------- Voie ----------
  // Point de la voie à la distance d derrière la position h ; null si la voie s'arrête avant
  // (trail : les tronçons que le train a pris, pour repasser par les mêmes branches d'aiguillage)
  back(h, d, trail = null) {
    const r = this.tracks.move(h, -d, trail);
    return r.end ? null : r;
  }
  pointAt(h, out) { return this.tracks.pointAt(h, out); }
  length(train) { return train.cars.length * PITCH - GAP; }
  node(q, r, y) { this.tracks.update(); return this.tracks.nodes.get(q + ',' + r + ',' + y); }

  // ---------- Poser ----------
  // Une locomotive sur le rail de train de la case (q, r, y), tournée vers yaw (regard du
  // joueur) : son avant sur le rail visé, elle s'étend derrière. Renvoie un message d'erreur, ou null
  spawnLoco(q, r, y, yaw, style = '') {
    // sur un nœud, ou n'importe où sur la voie (entre deux nœuds d'une longue ligne)
    const n = this.node(q, r, y), dx = -Math.sin(yaw), dz = -Math.cos(yaw);
    const c = hexToWorld(q, r);
    const head = n ? this.tracks.startAt(n, dx, dz) : this.tracks.nearest(c.x, y + 0.3, c.z, dx, dz);
    if (!head) return 'Pose la locomotive sur un rail de train';
    if (!head || !this.back(head, CAR_LEN)) return 'Pas assez de voie derrière : il faut 11 rails de train à la suite pour la locomotive';
    const train = { id: this.nextId++, cars: [], head, v: 0, trail: [], ver: this.tracks.version };
    train.cars.push(this.makeCar(train, 'loco', null, 0, style));
    this.trains.push(train);
    this.placeCars(train);
    return null;
  }
  // Un wagon posé sur un rail de train juste derrière un train : il s'attelle au dernier véhicule
  addWagon(q, r, y, kind = 'wagon') {
    if (!KINDS.includes(kind) || kind === 'loco') kind = 'wagon';
    const n = this.node(q, r, y), c0 = hexToWorld(q, r);
    const at = n ? n.pos : this.tracks.nearest(c0.x, y + 0.3, c0.z, 1, 0) && new THREE.Vector3(c0.x, y, c0.z);
    if (!at) return 'Pose le wagon sur un rail de train, derrière une locomotive';
    let best = null, bestD = PITCH * 0.6;
    for (const t of this.trains) {
      const tail = this.back(t.head, this.length(t), t.trail);
      if (!tail) continue;
      const p = this.pointAt(tail, new THREE.Vector3());
      const d = Math.hypot(p.x - at.x, p.z - at.z);
      if (d < bestD) { bestD = d; best = t; }
    }
    if (!best) return 'Pose le wagon sur la voie, juste derrière la locomotive (ou le dernier wagon)';
    if (kind === 'tender' && !isSteam(locoOf(best))) return 'Le tender va derrière une locomotive à vapeur';
    if (!this.back(best.head, this.length(best) + PITCH, best.trail)) return 'Pas assez de voie derrière le train pour ce wagon';
    best.cars.push(this.makeCar(best, kind));
    this.placeCars(best);
    return null;
  }
  // Enlève une voiture (elle seule : les autres restent où elles sont ; au milieu du train, il est
  // coupé en deux). Renvoie les objets à rendre : la voiture et ce qu'elle transportait ([{ id, n, w }])
  removeCar(car) {
    const t = car.train, i = t.cars.indexOf(car), gone = [car];
    if (i > 0 && i < t.cars.length - 1) this.split(t, i + 1); // (les voitures de derrière : un autre train)
    const extra = [];
    for (const c of gone) {
      for (const p of this.riders(c)) this.dismount(p);
      this.scene.remove(c.mesh);
      if (c.deck) extra.push(...this.removeDeck(c));
    }
    if (i === 0 && t.cars.length > 1) this.shiftHead(t, -PITCH); // (la tête : le reste ne bouge pas)
    t.cars = t.cars.filter((c) => !gone.includes(c));
    if (!t.cars.length) this.trains = this.trains.filter((x) => x !== t);
    else this.placeCars(t);
    const out = [];
    for (const c of gone) {
      out.push({ id: (c.kind === 'loco' && STYLES[c.style]?.item) || ITEM_OF[c.kind] || WAGON, n: 1 });
      for (const st of c.box?.slots || []) if (st) out.push(st);
    }
    return [...out, ...extra];
  }
  // Tout un train (sa voie a disparu) : les objets de toutes ses voitures
  removeTrain(t) {
    const out = [];
    for (const c of [...t.cars].reverse()) out.push(...this.removeCar(c));
    this.trains = this.trains.filter((x) => x !== t);
    return out;
  }
  // Recule (ou avance) l'avant du train de d le long de la voie, sans bouger les voitures restantes
  shiftHead(t, d) {
    const r = this.tracks.move(t.head, d, d < 0 ? t.trail : null);
    if (r.end) return false;
    t.trail = r.back ? t.trail.slice(r.back) : r.e !== t.head.e ? [t.head.e.key, ...t.trail] : t.trail;
    t.head = { e: r.e, s: r.s, rev: r.rev };
    return true;
  }
  // ---------- Atteler, dételer (clic molette sur une voiture) ----------
  // Coupe le train t avant sa voiture i : les voitures i et suivantes forment un autre train
  // (qui garde la vitesse : une rame lancée continue sur son élan)
  split(t, i) {
    if (i <= 0 || i >= t.cars.length) return null;
    const r = this.tracks.move(t.head, -i * PITCH, t.trail);
    const nt = {
      id: this.nextId++, cars: t.cars.slice(i), head: { e: r.e, s: r.s, rev: r.rev }, v: t.v,
      trail: r.back ? t.trail.slice(r.back) : t.trail.slice(), ver: this.tracks.version,
    };
    for (const c of nt.cars) c.train = nt;
    t.cars = t.cars.slice(0, i);
    this.trains.push(nt);
    this.placeCars(t);
    this.placeCars(nt);
    return nt;
  }
  // Attelle le train rear derrière le train front (l'avant de rear touche l'arrière de front)
  join(front, rear) {
    const r = this.tracks.move(front.head, -front.cars.length * PITCH, front.trail);
    front.trail = [...front.trail.slice(0, r.back), ...rear.trail].slice(0, 600);
    for (const c of rear.cars) c.train = front;
    front.cars.push(...rear.cars);
    front.v = (front.v + rear.v) / 2;
    this.trains = this.trains.filter((x) => x !== rear);
    this.placeCars(front);
  }
  // Clic molette sur la voiture car : attelée à celle de devant, on la dételle ; en tête de son
  // train, on l'attelle à un train tout proche (devant elle, ou derrière son train). Renvoie un
  // message pour le joueur
  couple(car) {
    const t = car.train, i = t?.cars.indexOf(car);
    if (!t || i < 0) return null;
    if (i > 0) { this.split(t, i); return 'Dételé : les voitures de derrière restent sur la voie'; }
    const p = new THREE.Vector3(), q = new THREE.Vector3(), d1 = new THREE.Vector3(), d2 = new THREE.Vector3();
    const tailOf = (x) => this.back(x.head, this.length(x), x.trail);
    const near = (a, b) => {
      if (!a || !b) return false;
      this.pointAt(a, p); this.pointAt(b, q);
      return p.distanceTo(q) < 3 && this.tracks.dirAt(a, d1).dot(this.tracks.dirAt(b, d2)) > 0.6;
    };
    for (const o of this.trains) {
      if (o === t) continue;
      // un train juste devant nous (son arrière contre notre avant), ou juste derrière nous
      if (near(tailOf(o), t.head)) { this.join(o, t); return 'Attelé au train de devant'; }
      if (near(tailOf(t), o.head)) { this.join(t, o); return 'Attelé au train de derrière'; }
    }
    return 'Rien à atteler : approche un train à moins de 3 blocs, dans le même sens';
  }
  // Enlève le plateau d'un wagon plat ; renvoie ses blocs (et le contenu de ses coffres, voir
  // onDeckGone) en objets
  removeDeck(c) {
    const d = c.deck, S = this.structs, out = [];
    c.deck = null;
    if (!d || !S?.list.includes(d)) return out;
    const n = new Map();
    for (const [, , , id] of d.list) if (!BLOCKS[id]?.deck) { const k = BLOCKS[id]?.pick ?? id; n.set(k, (n.get(k) || 0) + 1); }
    for (const [id, k] of n) out.push({ id, n: k });
    out.push(...(this.onDeckGone?.(d) || []));
    S.remove(d);
    return out;
  }
  clear() {
    this.occ = null; // (voir oncoming)
    for (const t of this.trains) for (const c of t.cars) {
      for (const p of this.riders(c)) this.dismount(p);
      this.scene.remove(c.mesh);
      if (c.deck && this.structs?.list.includes(c.deck)) this.structs.remove(c.deck);
    }
    this.trains = [];
  }

  // ---------- Passagers ----------
  // Ceux qui sont à bord de la voiture c (le conducteur, ou les passagers assis)
  riders(c) { return c.seats ? c.seats.filter(Boolean) : c.rider ? [c.rider] : []; }
  // Monter : dans la cabine de la locomotive (conduire), ou sur une place libre du wagon
  // passagers (seat : celle-là si elle est libre). Renvoie vrai si on est monté
  mount(car, player, seat = -1) {
    if (player.riding) return false;
    if (car.seats) {
      const i = seat >= 0 && seat < car.seats.length && !car.seats[seat] ? seat : car.seats.findIndex((s) => !s);
      if (i < 0) return false;
      car.seats[i] = player;
      player.seat = i;
    } else if (car.kind === 'loco' || car.kind === 'tail' || car.kind === 'armored') {
      if (car.rider) return false;
      car.rider = player;
      // (face au pare-brise : vers l'avant, ou vers l'arrière dans le wagon de queue)
      if (Number.isFinite(player.yaw)) player.yaw = Math.atan2(-car.dir.x, -car.dir.z) + (car.kind === 'tail' ? Math.PI : 0);
    } else return false;
    player.riding = car;
    player.fly = false;
    car.yaw0 = null;
    return true;
  }
  dismount(player) {
    const car = player.riding;
    if (!car) return;
    if (car.seats) { const i = car.seats.indexOf(player); if (i >= 0) car.seats[i] = null; }
    else car.rider = null;
    player.riding = null;
    player.seat = undefined;
    player.vel.set(0, 0, 0);
    // descend sur le côté de la voiture
    const side = new THREE.Vector3(-car.dir.z, 0, car.dir.x).normalize();
    for (const s of [1, -1]) {
      const p = car.pos.clone().addScaledVector(side, s * (HALF_W + 0.7));
      const y = Math.floor(car.pos.y + 0.05);
      if (!this.solidAt(p.x, y, p.z) && !this.solidAt(p.x, y + 1, p.z)) { player.pos.set(p.x, y, p.z); return; }
    }
    player.pos.set(car.pos.x, car.pos.y + ROOF + 0.1, car.pos.z);
  }
  solidAt(x, y, z) {
    const { q, r } = worldToHex(x, z);
    return SOLID[this.world.getBlock(q, r, y)] === 1;
  }
  // Remettre du combustible dans la locomotive : n objets id ; renvoie combien ont été pris
  // (charbon, bois pour un moteur thermique ; voltite pour un moteur électrique ; rien pour la fusion)
  refuel(loco, id, n) {
    if (loco?.kind !== 'loco') return 0;
    const L = this.limits(loco.train), s = fuelTable(L.power)[id];
    if (!s) return 0;
    const k = Math.max(0, Math.min(n, Math.floor((L.tank - (loco.fuel || 0)) / s)));
    loco.fuel = (loco.fuel || 0) + k * s;
    if (k) loco.train.noFuel = false;
    return k;
  }
  // Ce que brûle cette locomotive (l'objet id) : vrai si on peut le mettre dans son réservoir
  burns(loco, id) { return !!fuelTable(this.limits(loco.train).power)[id]; }
  // Pilote automatique de la locomotive (on : l'allumer ou l'éteindre ; sinon, il bascule)
  setAuto(loco, on = null) {
    const t = loco?.train;
    if (!t || loco.kind !== 'loco') return false;
    const want = on === null ? !t.auto : on;
    t.auto = want ? { v: Math.max(8, Math.min(this.limits(t).vmax, t.v)) } : null;
    if (want) t.wait = 0;
    return want;
  }
  // ---------- Composants de la locomotive ----------
  // Pose l'objet id (0 : rien) à l'emplacement slot ('engine', ou 0..7 pour les composants) ;
  // renvoie ce qui y était (0 : rien), ou -1 si l'objet ne va pas là
  setComp(loco, slot, id) {
    if (loco?.kind !== 'loco') return -1;
    const c = id ? compOf(id) : null;
    if (id && (!c || (slot === 'engine') !== (c.slot === 'engine'))) return -1;
    if (slot === 'engine' && isSteam(loco)) return -1; // (la vapeur garde sa chaudière)
    const C = loco.comps;
    let old;
    if (slot === 'engine') { old = C.engine; C.engine = id; }
    else if (Number.isInteger(slot) && slot >= 0 && slot < PART_SLOTS) { old = C.parts[slot]; C.parts[slot] = id; }
    else return -1;
    loco.train.loadT = -99; // (on recalcule ce que peut faire le train)
    const L = this.limits(loco.train);
    if (loco.fuel > L.tank) loco.fuel = L.tank;
    if (old && compOf(old)?.power !== c?.power && slot === 'engine') loco.fuel = 0; // (autre énergie : réservoir vidé)
    return old || 0;
  }
  // Itinéraire : les gares à desservir, dans l'ordre (en boucle) ; vide : toutes les gares
  setRoute(loco, keys) {
    const t = loco?.train;
    if (!t) return;
    t.route = keys.filter((k) => typeof k === 'string').slice(0, 64);
    t.routeI = 0;
    t.choices = null;
    t.pathT = -99;
  }

  // ---------- Simulation ----------
  // Ce que peut faire le train (selon sa longueur, son chargement et les composants de la
  // locomotive) : accélération, vitesse maximale, freinage, consommation, réservoir...
  limits(t) {
    if (!t.load || (this.time || 0) - (t.loadT || -9) > 1) {
      // (1 par voiture en plus, et le chargement : objets des wagons, blocs des plateaux)
      let cargo = 0;
      for (const c of t.cars) {
        for (const s of c.box?.slots || []) if (s) cargo += s.n;
        if (c.deck) cargo += c.deck.list.length * 8;
      }
      const loco = locoOf(t), C = loco?.comps || { engine: 0, parts: [] };
      const eng = STYLES[loco?.style]?.eng || compOf(C.engine) || BASE_ENGINE, n = {};
      // (pas de maximum : chaque composant posé compte, les 8 emplacements sont la seule limite)
      for (const id of C.parts) { const p = compOf(id); if (p) n[p.kind] = (n[p.kind] || 0) + 1; }
      const k = (kind) => n[kind] || 0;
      const elec = eng.power === 'elec', fuel = eng.power === 'fuel' || eng.power === 'steam';
      const traction = n.traction || 0;
      const m = 1 + 0.35 * (t.cars.length - 1) * 0.8 ** traction * (eng.heavy || 1) + cargo / 1500;
      let acc = ACC * eng.acc, vmax = eng.vmax, burn = eng.burn;
      if (fuel) acc *= 1.3 ** k('turbo');
      if (elec) { acc *= 1.15 ** k('transformer'); vmax *= 1.15 ** k('transformer') * 1.1 ** k('wiring'); }
      vmax *= 1.05 ** k('throttle');
      acc *= 1.1 ** k('sander');
      burn *= 0.8 ** k('radiator') * (fuel ? 0.85 ** k('pump') : 1) * 0.95 ** k('exhaust') * 0.95 ** k('alternator');
      t.load = {
        m, engine: C.engine, power: eng.power,
        acc: (acc * 1.6) / (0.6 + m),
        // (un train très long et chargé ralentit : des moteurs de traction l'allègent)
        vmax: vmax * Math.max(0.2, Math.min(1, 1.12 - 0.04 * m)),
        burn: (0.4 + 0.15 * m) * burn,
        brake: BRAKE * (1 + 0.5 * k('brake')) * 1.25 ** k('air'),
        slope: SLOPE * 0.5 ** k('sander'),
        tank: FUEL_MAX * (1 + k('tank')) * (1 + 0.5 * k('battery')),
        smoke: 0.4 ** k('exhaust'), light: Math.min(3, 1 + 0.6 * k('alternator')), horn: !!n.horn, whistle: !!n.whistle || eng.power === 'steam',
        // (les composants posés, par sorte : combien, et s'ils servent avec ce moteur ; voir le panneau)
        parts: Object.entries(n).map(([kind, count]) => ({ kind, n: count, on: !((kind === 'turbo' || kind === 'pump') && !fuel) && !((kind === 'transformer' || kind === 'wiring') && !elec) })),
      };
      t.loadT = this.time || 0;
    }
    return t.load;
  }
  // input : { forward, back } du conducteur (le joueur local, s'il est dans une locomotive)
  update(dt, player, input) {
    this.tracks.update();
    this.time = (this.time || 0) + dt;
    if (this.remote) { this.updateRemote(dt, player); this.effects(dt, player); this.lights(); return; }
    // la voie a été refaite (un rail posé ou cassé) : chaque train se recale sur son tronçon ;
    // si son tronçon n'existe plus, le train s'en va (ses objets sont rendus, voir onLost)
    for (const t of [...this.trains]) {
      if (t.ver === this.tracks.version) continue;
      const e = this.tracks.edges.get(t.head.e.key);
      if (e) { t.head = { e, s: Math.min(t.head.s, e.L), rev: t.head.rev }; t.ver = this.tracks.version; t.pathT = -99; continue; }
      { const at = t.cars[0]?.pos.clone(); this.onLost?.(this.removeTrain(t), at); }
    }
    const fuelOn = this.fuelOn();
    this.local = { player, input };
    for (const t of this.trains) {
      const loco = locoOf(t);
      // (le conducteur : dans la cabine de la locomotive, ou dans celle du wagon de queue : là,
      // tout est à l'envers, on conduit en marche arrière ; nous, ou un joueur en ligne)
      const tail = t.cars.find((c) => c.kind === 'tail' && c.rider);
      const rider = loco?.kind === 'loco' && loco.rider ? loco.rider : tail ? tail.rider : null;
      const inp = rider === player ? input : rider?.input;
      const rev = !!tail && rider === tail.rider;
      const fwd = !!(rev ? inp?.back : inp?.forward), bwd = !!(rev ? inp?.forward : inp?.back);
      const L = this.limits(t);
      const vback = rev ? L.vmax * 0.8 : VBACK;
      const d = this.tracks.dirAt(t.head, this.tmp);
      // ce qui attend le train devant (gares, panneaux, aiguillages, bout de la voie)
      this.look(t, L);
      let a = -L.slope * d.y, drive = 0;
      if (t.wait > 0) {
        // arrêté en gare : on repart au bout de 10 secondes
        t.v = 0;
        t.wait -= dt;
        if (t.wait <= 0) { t.wait = 0; this.onDepart?.(t); }
        a = 0;
        drive = 1;
      } else if (t.auto) {
        // pilote automatique : Z / S changent la vitesse voulue (S jusqu'à l'arrêt : il s'éteint)
        if (fwd) t.auto.v = Math.min(L.vmax, t.auto.v + 5 * dt);
        if (bwd) { t.auto.v -= 6 * dt; if (t.auto.v < 1) { t.auto = null; this.onAutoOff?.(t); } }
        if (t.auto) {
          const target = this.autoTarget(t, L);
          if (t.v < target - 0.1) drive = 1;
          else if (t.v > target + 0.1) drive = -1;
          if (t.stopNow) {
            // en gare : arrêt, porte ouverte 10 secondes (itinéraire : la gare suivante)
            const st = t.stopNow;
            t.stopNow = null;
            t.v = 0;
            t.wait = STOP_TIME;
            t.lastStop = st.key;
            t.sinceStop = 0;
            if (t.route?.length) { t.routeI = ((t.routeI || 0) + 1) % t.route.length; t.choices = null; t.pathT = -99; }
            this.onStop?.(t, st);
            drive = 0;
          }
          if (drive > 0) a += L.acc;
          else if (drive < 0) a -= Math.min(L.brake, AUTO_BRAKE * 1.6 + (t.v - target));
        }
      } else {
        const cap = t.limit ? Math.min(L.vmax, t.limit) : L.vmax;
        if (fwd) { a += t.v < -0.05 ? L.brake : t.v < cap ? L.acc : 0; drive = 1; }
        if (bwd) { a += t.v > 0.05 ? -L.brake : t.v > -vback ? -L.acc * 0.7 : 0; drive = 1; }
        // (au-dessus de la limitation : le train freine tout seul)
        if (t.limit && Math.abs(t.v) > t.limit + 0.4) { a -= Math.sign(t.v) * Math.min(L.brake, 2 + Math.abs(t.v) - t.limit); drive = 1; }
      }
      // combustible (survie) : la traction le brûle ; sans combustible, le train ne fait que rouler
      // (moteur à fusion : il n'en a pas besoin)
      const traction = (fwd && t.v >= -0.05 && !t.auto) || (bwd && t.v <= 0.05 && !t.auto) || (t.auto && drive > 0);
      // (vapeur : le tender remet du combustible dans la chaudière dès qu'il y a de la place)
      if (fuelOn && L.power === 'steam' && loco) {
        for (const c of t.cars) {
          if (c.kind !== 'tender' || loco.fuel > L.tank - 450) continue;
          const id = takeOne(c.box, STEAM_FUEL);
          if (id) { loco.fuel = Math.min(L.tank, (loco.fuel || 0) + TRAIN_FUEL[id]); t.noFuel = false; break; }
        }
      }
      if (fuelOn && traction && loco?.kind === 'loco' && L.power !== 'none') {
        if (loco.fuel > 0) loco.fuel = Math.max(0, loco.fuel - L.burn * dt);
        else {
          a = -L.slope * d.y;
          drive = 0;
          if (!t.noFuel) { t.noFuel = true; this.onNoFuel?.(t); }
        }
      }
      t.accel = a;
      t.braking = a < -3 && Math.abs(t.v) > 2;
      t.v += a * dt;
      // frottements (sans repartir en arrière)
      const f = (ROLL + DRAG * t.v * t.v) * dt;
      if (!drive) t.v = Math.abs(t.v) <= f ? 0 : t.v - Math.sign(t.v) * f;
      t.v = Math.max(-vback - 1, Math.min(L.vmax + 1, t.v));
      t.prev = { head: t.head, trail: t.trail };
      if (t.v) this.advance(t, t.v * dt);
      this.placeCars(t);
      t.sinceStop = (t.sinceStop || 0) + Math.abs(t.v) * dt;
      if (t.lastStop && t.sinceStop > 25) t.lastStop = null;
      t.still = t.v ? 0 : (t.still || 0) + dt;
      t.dist = (t.dist || 0) + Math.abs(t.v) * dt;
      // bruit des roues : un « tac-tac » toutes les 3 cases parcourues
      t.odo = (t.odo || 0) + Math.abs(t.v) * dt;
      if (t.odo > 3) { t.odo = 0; if (Math.abs(t.v) > 0.5) this.onClack?.(loco.pos, Math.abs(t.v)); }
    }
    this.collideTrains();
    this.stepShells(dt);
    if (this.structs && !this.structs.remote) this.collideStructs(dt);
    this.seatRiders(player);
    // trémies et poseurs de rails : 4 fois par seconde ; détecteurs : 10 fois
    this.workT = (this.workT || 0) + dt;
    if (this.workT > 0.25) { this.workT = 0; for (const t of this.trains) this.work(t, fuelOn); }
    this.detT = (this.detT || 0) + dt;
    if (this.detT > 0.1) { this.detT = 0; this.detect(); }
    if (player && !player.riding) this.pushPlayer(player);
    this.effects(dt, player);
    this.lights();
  }
  // La gare où doit s'arrêter le train : celle de son itinéraire (ou n'importe laquelle)
  target(t) { return t.route?.length ? t.route[(t.routeI || 0) % t.route.length] : null; }
  // Ce qui attend le train devant (vu de sa cabine) : t.info ; un panneau qu'on passe change la
  // limitation ; itinéraire : les aiguillages se règlent sur le chemin de la prochaine gare
  look(t, L) {
    if (t.v < -0.05) { t.info = null; return; }
    const goal = this.target(t);
    const cab = this.back(t.head, CAB_OFF, t.trail) || t.head;
    const look = (Math.max(t.v, t.auto?.v || 0) ** 2) / (2 * AUTO_BRAKE) + 60;
    const info = this.tracks.ahead(cab, look + CAB_OFF, { skip: t.lastStop, want: goal ? (st) => st.key === goal : null, skipSign: t.lastSign });
    t.info = info;
    if (info.sign && info.sign.dist < 0.4) {
      t.limit = info.sign.sg.kmh ? info.sign.sg.kmh / 3.6 : null;
      t.lastSign = info.sign.sg.key;
      this.onSign?.(t, info.sign.sg);
    }
    if (goal) {
      // (le chemin, refait toutes les 2 secondes ou quand la voie change)
      if (!t.choices || (this.time || 0) - (t.pathT || -99) > 2) {
        t.pathT = this.time || 0;
        t.choices = this.tracks.path(t.head, goal, this.oncoming(t));
        t.routeLost = !t.choices;
      }
      const sw = info.sw;
      if (sw && sw.dist < 80 && t.choices) {
        const k = this.tracks.swKey(sw.node, sw.side);
        if (t.choices.has(k)) this.tracks.setSwitch(sw.node, sw.side, t.choices.get(k));
      }
    } else t.routeLost = false;
  }
  // Les tronçons (et le sens) où le train t croiserait un autre train de face : ceux qu'il occupe,
  // et ceux qu'il va prendre (sur 3000 blocs s'il roule : les longues lignes) ; tronçon + sens -> pénalité (voir
  // tracks.path : l'itinéraire prend l'autre voie d'une double voie au lieu de foncer sur lui).
  // Refait au plus une fois par seconde pour tous les trains.
  oncoming(t) {
    const now = this.time || 0;
    if (!this.occ || now - this.occT > 1) {
      this.occT = now;
      this.occ = new Map(); // "tronçon + sens opposé" -> trains
      const mark = (o, h) => {
        const k = h.e.key + (h.rev ? '>' : '<'); // (le sens où l'on irait vers lui)
        let set = this.occ.get(k);
        if (!set) this.occ.set(k, (set = new Set()));
        set.add(o);
      };
      for (const o of this.trains) {
        const len = this.length(o);
        for (let d = 0; d <= len; d += 8) { const r = this.tracks.move(o.head, -Math.min(d, len), o.trail); mark(o, r); if (r.end) break; }
        if (o.v > 0.5 || (o.auto && !o.wait)) {
          let h = o.head;
          for (let d = 0; d < 3000; d += 12) { const r = this.tracks.move(h, 12, null, o.route?.length ? o.choices : null); if (r.end) break; mark(o, r); h = r; }
        }
      }
    }
    const avoid = new Map();
    for (const [k, set] of this.occ) if (set.size > 1 || !set.has(t)) avoid.set(k, 3000);
    return avoid;
  }
  // Vitesse voulue par le pilote automatique : sa consigne, mais moins avant une gare (arrêt, la
  // cabine en face), un panneau, le bout de la voie, ou un autre train devant
  autoTarget(t, L) {
    let target = Math.min(t.auto.v, L.vmax);
    if (t.limit) target = Math.min(target, t.limit);
    const look = (t.v * t.v) / (2 * AUTO_BRAKE) + 40;
    const info = t.info || { station: null, end: null, sign: null };
    const lim = (dist) => Math.sqrt(2 * AUTO_BRAKE * Math.max(0, dist));
    if (info.station) {
      const d = info.station.dist;
      target = Math.min(target, Math.max(d > 0.5 ? 0.8 : 0, lim(d - 0.1)));
      if (d < 0.5 && t.v < 1.5) t.stopNow = info.station.st;
    }
    if (info.sign && info.sign.sg.kmh) {
      // (on arrive au panneau déjà à sa vitesse)
      const vs = info.sign.sg.kmh / 3.6;
      target = Math.min(target, Math.sqrt(vs * vs + 2 * AUTO_BRAKE * Math.max(0, info.sign.dist - 1)));
    }
    if (info.end !== null) {
      const d = info.end - CAB_OFF; // (de l'avant du train au bout de la voie)
      target = Math.min(target, this.canLay(t) ? LAY_SPEED : lim(d - 1));
    }
    // un autre train devant, sur notre chemin : la voie suivie pour de vrai (virages, aiguillages
    // tels qu'ils sont réglés), pas une ligne droite (elle coupait les voies d'à côté et les
    // croisements : le train s'arrêtait pour rien). Cherché toutes les 0,15 s.
    if ((this.time || 0) - (t.obsT ?? -9) > 0.15) { t.obsT = this.time || 0; t.obs = this.obstacleAhead(t, look + CAR_LEN); }
    if (t.obs !== null && t.obs !== undefined) target = Math.min(target, lim(t.obs - CAR_LEN / 2 - 4));
    return target;
  }
  // Distance (le long de la voie, depuis l'avant du train t) de la première voiture d'un autre
  // train posée sur son chemin, à moins de maxD ; null s'il n'y en a pas
  obstacleAhead(t, maxD) {
    const front = t.cars[0]?.pos;
    if (!front) return null;
    // (les voitures des autres trains assez proches : trois points chacune, le milieu et les bouts)
    const pts = [];
    for (const o of this.trains) {
      if (o === t) continue;
      for (const c of o.cars) {
        if (Math.abs(c.pos.x - front.x) > maxD + CAR_LEN || Math.abs(c.pos.z - front.z) > maxD + CAR_LEN) continue;
        const k = CAR_LEN * 0.42;
        pts.push(c.pos.x, c.pos.y, c.pos.z, c.pos.x + c.dir.x * k, c.pos.y, c.pos.z + c.dir.z * k, c.pos.x - c.dir.x * k, c.pos.y, c.pos.z - c.dir.z * k);
      }
    }
    if (!pts.length) return null;
    const p = _obs, R2 = 2.2 * 2.2;
    let h = t.head;
    for (let d = 0; d <= maxD; d += 2) {
      this.tracks.pointAt(h, p);
      for (let i = 0; i < pts.length; i += 3) {
        const dx = pts[i] - p.x, dz = pts[i + 2] - p.z;
        if (dx * dx + dz * dz < R2 && Math.abs(pts[i + 1] - p.y) < 3) return d;
      }
      // (aux aiguillages : le chemin que le train va prendre, pas leur position du moment ; sinon il
      // s'arrêtait pour un train sur la voie d'à côté, avant l'aiguillage qu'il allait régler)
      const n = this.tracks.move(h, 2, null, t.route?.length ? t.choices : null);
      if (n.end) break;
      h = n;
    }
    return null;
  }
  // Détecteurs de train : allumés (une source de courant) tant qu'une voiture passe au-dessus
  detect() {
    const W = this.world;
    for (const d of this.tracks.detectors) {
      let on = false;
      for (const c of this.cars) {
        const rx = d.pos.x - c.pos.x, rz = d.pos.z - c.pos.z, dy = d.pos.y - c.pos.y;
        if (dy > 1 || dy < -3.5 || rx * rx + rz * rz > (CAR_LEN / 2 + 2) ** 2) continue;
        const along = rx * c.dir.x + rz * c.dir.z;
        if (Math.abs(along) < CAR_LEN / 2 + 0.3 && Math.hypot(rx - c.dir.x * along, rz - c.dir.z * along) < 1.8) { on = true; break; }
      }
      const id = W.getBlock(d.q, d.r, d.y), want = on ? DETECTOR_ON : DETECTOR;
      if ((id === DETECTOR || id === DETECTOR_ON) && id !== want) { W.setBlock(d.q, d.r, d.y, want); if (on) this.onDetect?.(d); }
    }
  }
  // Passagers et conducteurs : à leur place ; le joueur local tourne avec la voiture (dans les
  // virages, la vue suit le train)
  seatRiders(player) {
    for (const t of this.trains) for (const c of t.cars) {
      const yaw = Math.atan2(-c.dir.x, -c.dir.z);
      const list = c.seats ? c.seats.map((p, i) => [p, i]).filter(([p]) => p) : c.rider ? [[c.rider, -1]] : [];
      for (const [p, i] of list) {
        this.seatOf(c, p.pos, i);
        p.vel.copy(c.vel);
        if (p === player && c.yaw0 !== null && c.yaw0 !== undefined) player.yaw += wrap(yaw - c.yaw0);
      }
      c.yaw0 = yaw;
    }
  }
  // ---------- Wagons au travail ----------
  work(t, fuelOn) {
    for (const c of t.cars) {
      if (c.kind === 'hopper') this.hopperWork(t, c);
      else if (c.kind === 'layer') this.layWork(t, c, fuelOn);
    }
  }
  // Trémie : ramasse les cartons (objets tombés) près de la voie ; arrêtée, elle se vide dans un
  // coffre placé sous les rails
  hopperWork(t, c) {
    const C = this.cartons;
    if (C) for (const k of [...C.list]) {
      const rx = k.pos.x - c.pos.x, rz = k.pos.z - c.pos.z, dy = k.pos.y - c.pos.y;
      if (dy < -2 || dy > 4.5 || rx * rx + rz * rz > (CAR_LEN / 2 + HALF_W + 2) ** 2) continue;
      const along = rx * c.dir.x + rz * c.dir.z;
      if (Math.abs(along) > CAR_LEN / 2 + 0.6 || Math.hypot(rx - c.dir.x * along, rz - c.dir.z * along) > HALF_W + 1.8) continue;
      let took = false;
      for (const st of k.items) { const left = putIn(c.box, st); if (left < st.n) took = true; st.n = left; }
      k.items = k.items.filter((st) => st.n > 0);
      if (!k.items.length) C.remove(k); else if (took) C.refresh(k);
      if (took) this.onPickup?.(c.pos);
    }
    if (t.still < 1 || !this.containers || !c.box.slots.some(Boolean)) return;
    // (les cases sous la voiture, sous le rail : un coffre ?)
    const y = Math.floor(c.pos.y + 0.05) - 1, seen = new Set();
    for (let a = -4; a <= 4; a += 0.5) {
      const h = worldToHex(c.pos.x + c.dir.x * a, c.pos.z + c.dir.z * a), k = h.q + ',' + h.r;
      if (seen.has(k)) continue;
      seen.add(k);
      for (const yy of [y, y - 1]) {
        const box = BLOCKS[this.world.getBlock(h.q, h.r, yy)]?.container === 'chest' ? this.containers.at(h.q, h.r, yy) : null;
        if (!box) continue;
        // une pile par passage (on voit le tas baisser)
        const i = c.box.slots.findIndex(Boolean);
        if (i < 0) return;
        const st = c.box.slots[i], left = putIn(box, st);
        if (left === st.n) continue;
        if (left) st.n = left; else c.box.slots[i] = null;
        this.onUnload?.(c.pos);
        return;
      }
    }
  }
  // Le train peut-il prolonger la voie devant lui ? (un wagon poseur, et des rails à poser)
  canLay(t) {
    const c = t.cars.find((x) => x.kind === 'layer');
    return !!c && (!this.fuelOn() || count(c.box, [TRACK_IDS[0]]) > 0);
  }
  // Poseur de rails : près du bout de la voie (le train va en avant), il pose le rail suivant dans
  // l'axe, dégage le passage (les blocs enlevés vont dans son coffre) et comble le vide dessous
  layWork(t, c, fuelOn) {
    if (c.arm) c.arm = Math.max(0, c.arm - 0.25);
    const rider = locoOf(t)?.rider, inp = rider && rider === this.local?.player ? this.local.input : rider?.input;
    const pushing = t.v > 0.05 || (t.auto && !t.wait) || !!inp?.forward;
    if (!pushing) return;
    // (le bout de la voie à moins de 4 cases devant : on pose la suite avant d'y arriver)
    const info = this.tracks.ahead(t.head, 4);
    if (info.end === null) return;
    const n = info.endNode, side = info.endSide;
    const k = -side > 0 ? n.axis : n.axis + 3, [dq, dr] = NEIGHBORS[k];
    const q = n.q + dq, r = n.r + dr, y = n.y, W = this.world;
    if (fuelOn && !count(c.box, [TRACK_IDS[0]])) { if (!t.noRails) { t.noRails = true; this.onNoRails?.(t); } return; }
    // le passage : 3 cases de large, 5 de haut, devant le nouveau rail (incassables : on s'arrête)
    const cw = hexToWorld(q, r), cells = [];
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const w = hexToWorld(q + a, r + b);
      if (Math.hypot(w.x - cw.x, w.z - cw.z) <= 1.75) cells.push([q + a, r + b]);
    }
    for (const [cq, cr] of cells) for (let yy = y; yy < y + 5; yy++) if (BLOCKS[W.getBlock(cq, cr, yy)]?.unbreakable) { if (!t.blocked) { t.blocked = true; this.onBlocked?.(t); } return; }
    const under = W.getBlock(q, r, y - 1);
    const needBallast = !SOLID[under];
    if (needBallast && fuelOn && !count(c.box, BALLAST)) { if (!t.noBallast) { t.noBallast = true; this.onNoBallast?.(t); } return; }
    t.noRails = t.noBallast = t.blocked = false;
    for (const [cq, cr] of cells) for (let yy = y; yy < y + 5; yy++) {
      const id = W.getBlock(cq, cr, yy);
      if (!id || isTrack(id) || (yy === y && cq === q && cr === r)) continue;
      if (BLOCKS[id]?.container) continue; // (on ne casse pas un coffre)
      W.setBlock(cq, cr, yy, 0);
      if (fuelOn && SOLID[id]) putIn(c.box, { id: BLOCKS[id]?.pick ?? id, n: 1 });
    }
    if (needBallast) W.setBlock(q, r, y - 1, fuelOn ? takeOne(c.box, BALLAST) : 244);
    if (fuelOn) takeOne(c.box, [TRACK_IDS[0]]);
    W.setBlock(q, r, y, TRACK_IDS[n.axis]);
    c.arm = 1;
    this.onLay?.(new THREE.Vector3(cw.x, y, cw.z));
  }
  // ---------- Chocs ----------
  // Deux voitures se touchent-elles ? (des points de l'axe de l'une, dans la boîte de l'autre :
  // bout à bout, elles se touchent vraiment ; côte à côte, à leur largeur)
  touch(a, b) {
    if (Math.abs(a.pos.y - b.pos.y) > 3 || a.pos.distanceToSquared(b.pos) > (CAR_LEN + 2 * HALF_W) ** 2) return false;
    const h = CAR_LEN / 2, p = new THREE.Vector3();
    for (const [u, v] of [[a, b], [b, a]]) {
      for (let i = 0; i <= 10; i++) {
        p.copy(u.pos).addScaledVector(u.dir, -h + (2 * h * i) / 10).sub(v.pos);
        const along = p.x * v.dir.x + p.z * v.dir.z;
        const lat = Math.hypot(p.x - v.dir.x * along, p.z - v.dir.z * along);
        if (Math.abs(along) < h + 0.15 && lat < HALF_W * 1.9) return true;
      }
    }
    return false;
  }
  // Deux trains qui se touchent : ils reviennent où ils étaient et s'arrêtent net (un choc)
  collideTrains() {
    for (let i = 0; i < this.trains.length; i++) for (let j = i + 1; j < this.trains.length; j++) {
      const A = this.trains[i], B = this.trains[j];
      if (!A.cars.some((a) => B.cars.some((b) => this.touch(a, b)))) continue;
      const speed = Math.abs(A.v) + Math.abs(B.v);
      for (const T of [A, B]) {
        if (T.prev && T.v) { T.head = T.prev.head; T.trail = T.prev.trail; this.placeCars(T); }
        T.v = 0;
      }
      if (speed > 1.5) this.onCrash?.(A.cars[0].pos, speed);
    }
  }
  // Les objets physiques contre les voitures : un train qui roule les pousse (et ralentit selon
  // leur masse) ; un objet qui fonce sur un train arrêté rebondit
  collideStructs(dt) {
    const S = this.structs, w = new THREE.Vector3(), rel = new THREE.Vector3();
    for (const t of this.trains) for (const c of t.cars) {
      for (const o of S.list) {
        if (o.kinematic || o.unloaded) continue;
        if (o.pos.distanceToSquared(c.pos) > (CAR_LEN / 2 + HALF_W + o.radius + 1) ** 2) continue;
        // un bloc de l'objet dans la voiture ?
        let hit = null;
        for (const b of o.list) {
          if (!SOLID[b[3]]) continue;
          const cc = hexToWorld(b[0], b[1]);
          S.toWorld(o, w.set(cc.x, b[2] + 0.5, cc.z), w);
          rel.subVectors(w, c.pos);
          const along = rel.dot(c.dir), lat = Math.hypot(rel.x - c.dir.x * along, rel.z - c.dir.z * along);
          if (Math.abs(along) < CAR_LEN / 2 + 0.4 && lat < HALF_W + 0.45 && rel.y > -0.5 && rel.y < ROOF + 0.5) { hit = { along, lat: rel.clone() }; break; }
        }
        if (!hit) continue;
        S.wake(o);
        const dir = c.dir, vT = t.v, vo = o.vel.dot(dir);
        if (Math.abs(vT) > 0.3) {
          // le train pousse : l'objet part à la vitesse du train (un peu plus vite), vers le haut un peu
          if ((vT > 0 && vo < vT * 1.1) || (vT < 0 && vo > vT * 1.1)) o.vel.addScaledVector(dir, vT * 1.1 - vo);
          o.vel.y = Math.max(o.vel.y, 1.5);
          // et ralentit selon la masse de l'objet
          const m = CAR_MASS * t.cars.length;
          t.v *= m / (m + o.mass * 0.5);
        } else {
          // train arrêté : l'objet est repoussé hors de la voiture (il rebondit)
          const n = hit.lat.setY(0);
          n.addScaledVector(dir, -n.dot(dir));
          if (n.lengthSq() < 1e-4) n.copy(dir).multiplyScalar(Math.sign(hit.along) || 1);
          n.normalize();
          const vn = o.vel.dot(n);
          if (vn < 0) o.vel.addScaledVector(n, -vn * 1.3);
          o.vel.addScaledVector(n, 2 * dt * 10);
        }
      }
    }
  }
  // Avance l'avant du train de ds le long de la voie (ds < 0 : recule). Butoir au bout de la voie
  advance(t, ds) {
    const n = Math.max(1, Math.ceil(Math.abs(ds) / 0.25)), h = ds / n;
    for (let i = 0; i < n; i++) {
      // (en avant, l'aiguillage choisit ; en arrière, on reprend le chemin parcouru)
      const nh = this.tracks.move(t.head, h, h < 0 ? t.trail : null);
      // en marche arrière, le dernier wagon doit encore avoir de la voie
      if (nh.end) { t.head = nh; t.v = 0; return; } // (butoir : bout de la voie)
      const trail = nh.back ? t.trail.slice(nh.back) : nh.e !== t.head.e ? [t.head.e.key, ...t.trail] : t.trail;
      if (h < 0 && !this.back(nh, this.length(t), trail)) { t.v = 0; return; }
      t.head = nh;
      t.trail = trail.length > 600 ? trail.slice(0, 600) : trail;
    }
  }
  // Place chaque voiture entre ses deux bogies
  placeCars(t) {
    // (vecteurs de travail réutilisés : rien n'est créé à chaque image, pour chaque voiture)
    const [F, R, x, y, z, lastR, lastDir] = _place, m = _placeM;
    let last = false;
    t.cars.forEach((c, i) => {
      const mid = CAR_LEN / 2 + i * PITCH;
      const a = this.back(t.head, mid - BOGIE, t.trail), b = this.back(t.head, mid + BOGIE, t.trail);
      if (a && b) { this.pointAt(a, F); this.pointAt(b, R); }
      else if (last) { F.copy(lastR).addScaledVector(lastDir, -GAP - (CAR_LEN / 2 - BOGIE)); R.copy(F).addScaledVector(lastDir, -2 * BOGIE); }
      else return;
      const fresh = c.pos.lengthSq() === 0;
      c.pos.addVectors(F, R).multiplyScalar(0.5);
      x.subVectors(F, R);
      if (x.lengthSq() < 1e-6) x.copy(c.dir); else x.normalize();
      c.dir.copy(x);
      z.crossVectors(x, y.set(0, 1, 0)).normalize();
      y.crossVectors(z, x);
      m.makeBasis(x, y, z);
      c.mesh.quaternion.setFromRotationMatrix(m);
      c.mesh.position.copy(c.pos);
      c.vel.copy(x).multiplyScalar(t.v);
      c.v = t.v;
      if (fresh) c.vel.set(0, 0, 0);
      if (c.deck) this.placeDeck(c);
      lastR.copy(R); lastDir.copy(x); last = true;
    });
  }
  // Le joueur à pied ne traverse pas les voitures : il est poussé sur le côté (ou reste sur le toit)
  pushPlayer(player) {
    for (const c of this.cars) {
      const dy = player.pos.y - c.pos.y;
      if (dy < -1.6 || dy > (isDeckKind(c.kind) ? DECK_Y - 0.4 : ROOF)) continue;
      const rx = player.pos.x - c.pos.x, rz = player.pos.z - c.pos.z;
      const along = rx * c.dir.x + rz * c.dir.z;
      if (Math.abs(along) > CAR_LEN / 2 + 0.2) continue;
      const sx = rx - c.dir.x * along, sz = rz - c.dir.z * along, side = Math.hypot(sx, sz), minD = HALF_W + 0.3;
      if (side >= minD) continue;
      if (dy > ROOF - 0.3) { player.pos.y = c.pos.y + ROOF; if (player.vel.y < 0) player.vel.y = 0; player.onGround = true; continue; } // sur le toit
      const nx = side > 1e-4 ? sx / side : -c.dir.z, nz = side > 1e-4 ? sz / side : c.dir.x;
      player.pos.x += nx * (minD - side);
      player.pos.z += nz * (minD - side);
    }
  }

  // ---------- Effets ----------
  // Fumée de la locomotive (plus épaisse quand elle accélère), étincelles sous les roues quand on
  // freine fort, bras du poseur de rails, tas de la trémie (voir onSmoke, onSparks dans main.js)
  effects(dt, player = this.local?.player) {
    const p = new THREE.Vector3(), v = new THREE.Vector3();
    for (const t of this.trains) {
      t.cars.forEach((c, i) => {
        const inner = c.mesh.children[0];
        // vitesse et accélération (en ligne : tirées du mouvement des voitures)
        const speed = this.remote ? c.vel.length() : Math.abs(t.v);
        const acc = this.remote ? (speed - (c.lastSpeed ?? speed)) / Math.max(dt, 1e-3) : (t.accel || 0) * Math.sign(t.v || 1);
        c.lastSpeed = speed;
        c.accS = (c.accS || 0) + (acc - (c.accS || 0)) * Math.min(1, dt * 4);
        if (c.kind === 'loco' && isSteam(c) && c.pos.distanceToSquared(this.view) < 140 * 140) this.steamFx(c, t, inner, dt, speed, p, v);
        else if (c.kind === 'loco' && this.onSmoke && c.pos.distanceToSquared(this.view) < 140 * 140) {
          // les trois ventilateurs du capot fument (au ralenti, quelques bouffées)
          const effort = Math.max(0, Math.min(1, c.accS / ACC));
          c.smoke = (c.smoke || 0) + dt * (1.2 + effort * 14 + speed * 0.25);
          while (c.smoke >= 1) {
            c.smoke -= 1;
            inner.localToWorld(p.set(-1.1 + Math.floor(Math.random() * 3) * 0.5, 1.16, (Math.random() - 0.5) * 0.2));
            v.copy(c.vel).multiplyScalar(-0.15).add(this.tmp.set((Math.random() - 0.5) * 0.6, 2.2 + effort * 2.5, (Math.random() - 0.5) * 0.6));
            if (Math.random() < (t.load?.smoke ?? 1)) this.onSmoke(p, v, 0.6 + effort * 0.8);
          }
        }
        if (this.onSparks && speed > 2.5 && c.accS < -3.5 && c.pos.distanceToSquared(this.view) < 90 * 90) {
          c.spark = (c.spark || 0) + dt * Math.min(40, -c.accS * 3);
          while (c.spark >= 1) {
            c.spark -= 1;
            inner.localToWorld(p.set((Math.random() < 0.5 ? -0.95 : 0.95) + (Math.random() < 0.5 ? -0.28 : 0.28), 0.08, Math.random() < 0.5 ? -0.33 : 0.33));
            v.copy(c.dir).multiplyScalar(-Math.sign(t.v || 1) * (2 + Math.random() * 3)).add(this.tmp.set((Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2));
            this.onSparks(p, v);
          }
        }
        if (c.kind === 'armored') this.aimTurrets(c, this.remote && player?.riding === c ? player : null);
        // trémie : le tas suit le chargement ; poseur : le bras s'agite quand il pose
        const ud = c.mesh.userData;
        if (ud.load) {
          const fill = c.box ? c.box.slots.filter(Boolean).length / CHEST_SLOTS : (c.fill || 0);
          ud.load.visible = fill > 0;
          ud.load.scale.y = Math.max(0.001, fill * 0.56);
        }
        if (ud.arm) {
          c.armPh = (c.armPh || 0) + dt * (c.arm ? 7 : 1.2);
          const k = c.arm ? 1 : 0.15;
          ud.arm.rotation.z = 0.25 - Math.max(0, Math.sin(c.armPh)) * 0.55 * k;
          ud.fore.rotation.z = -0.25 + Math.max(0, Math.sin(c.armPh)) * 0.7 * k;
        }
      });
    }
  }
  // Tourelles du wagon blindé : elles suivent le regard du tireur (aim : [angle, hausse], dans le
  // repère du wagon) ; sans tireur, le canon avant regarde devant, l'autre derrière
  aimOf(c, shooter) {
    if (!shooter) return c.aim || [0, 0];
    const yaw = shooter.yaw, pitch = shooter.pitch || 0;
    const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
    const f = dx * c.dir.x + dz * c.dir.z, s = dx * -c.dir.z + dz * c.dir.x;
    return [Math.atan2(-s, f), Math.max(-0.12, Math.min(0.7, pitch))];
  }
  aimTurrets(c, shooter) {
    const ud = c.mesh.userData;
    if (!ud.turrets) return;
    // (hôte : le tireur assis ; invité : soi-même si on tire, sinon la visée reçue de l'hôte)
    const aim = shooter || c.rider ? this.aimOf(c, shooter || c.rider) : this.remote && c.riderPid >= 0 ? c.aim : null;
    c.aim = aim;
    for (const tu of ud.turrets) {
      const want = aim ? aim[0] : tu.back ? Math.PI : 0, pitch = aim ? aim[1] : 0;
      tu.t.rotation.y += wrap(want - tu.t.rotation.y) * 0.25;
      tu.b.rotation.z += (pitch - tu.b.rotation.z) * 0.25;
    }
  }
  // Tir d'un obus par le wagon blindé c, dans la direction dir (le regard du tireur)
  fire(c, dir) {
    if (c?.kind !== 'armored' || this.remote) return false;
    const tu = c.mesh.userData.turrets?.[0];
    if (!tu) return false;
    c.mesh.updateMatrixWorld(true);
    const p = tu.b.localToWorld(new THREE.Vector3(0.86, 0, 0));
    const v = dir.clone().normalize().multiplyScalar(SHELL_SPEED).add(c.vel);
    this.M ||= materials();
    this.shellGeo ||= new THREE.CylinderGeometry(0.12, 0.12, 0.5, 6).rotateZ(Math.PI / 2);
    const mesh = new THREE.Mesh(this.shellGeo, this.M.coque);
    mesh.position.copy(p);
    this.scene.add(mesh);
    (this.shells ||= []).push({ pos: p, vel: v, life: SHELL_LIFE, mesh, from: c });
    this.onFire?.(p, dir, c);
    return true;
  }
  // Les obus volent (pesanteur), et explosent sur le premier bloc plein ou un autre train
  stepShells(dt) {
    if (!this.shells?.length) return;
    const n = 4, h = dt / n, tmp = new THREE.Vector3();
    for (const s of [...this.shells]) {
      let hit = false;
      for (let i = 0; i < n && !hit; i++) {
        s.vel.y -= SHELL_G * h;
        s.pos.addScaledVector(s.vel, h);
        const { q, r } = worldToHex(s.pos.x, s.pos.z);
        if (SOLID[this.world.getBlock(q, r, Math.floor(s.pos.y))] || s.pos.y < -DEPTH) hit = true;
        for (const c of this.cars) {
          if (hit || c === s.from || c.pos.distanceToSquared(s.pos) > 36) continue;
          tmp.subVectors(s.pos, c.pos);
          const along = tmp.dot(c.dir), side = Math.hypot(tmp.x - c.dir.x * along, tmp.z - c.dir.z * along);
          if (Math.abs(along) < CAR_LEN / 2 && side < HALF_W && tmp.y > 0 && tmp.y < ROOF) hit = true;
        }
      }
      s.life -= dt;
      s.mesh.position.copy(s.pos);
      s.mesh.lookAt(tmp.copy(s.pos).add(s.vel));
      s.mesh.rotateY(Math.PI / 2);
      if (hit || s.life <= 0) {
        this.scene.remove(s.mesh);
        this.shells = this.shells.filter((x) => x !== s);
        if (hit) this.onShellHit?.(s.pos.x, s.pos.y, s.pos.z);
      }
    }
  }
  // Vapeur : panache de la cheminée en bouffées (au rythme des roues), jets de vapeur des
  // cylindres au démarrage ; les roues motrices tournent et leur bielle suit
  steamFx(c, t, inner, dt, speed, p, v) {
    const ud = c.mesh.userData, war = c.style === 'war';
    const signed = this.remote ? c.vel.dot(c.dir) : t.v;
    if (ud.wheels) {
      c.wheelA = ((c.wheelA || 0) - (signed * dt) / (ud.wheelR * SC)) % (Math.PI * 2);
      for (const w of ud.wheels) w.rotation.z = c.wheelA;
      const cx = Math.cos(c.wheelA) * ud.crank, cy = Math.sin(c.wheelA) * ud.crank;
      for (const r of ud.rods) { r.position.x = -0.03 + cx; r.position.y = ud.wheelR + cy; }
      for (const pi of ud.pistons) pi.position.x = 0.62 + cx;
    }
    if (!this.onSmoke) return;
    const effort = Math.max(0, Math.min(1, c.accS / ACC));
    // bouffées : 4 par tour de roue (au moins une par seconde à l'arrêt)
    const rate = Math.max(1, (4 * speed) / (2 * Math.PI * 0.16 * SC)) * (0.6 + effort);
    c.smoke = (c.smoke || 0) + dt * Math.min(14, rate);
    while (c.smoke >= 1) {
      c.smoke -= 1;
      inner.localToWorld(p.set(war ? 1.22 : 0.92, war ? 1.26 : 1.27, 0));
      v.copy(c.vel).multiplyScalar(-0.1).add(this.tmp.set((Math.random() - 0.5) * 0.5, 3.2 + effort * 3, (Math.random() - 0.5) * 0.5));
      this.onSmoke(p, v, 0.9 + effort * 1.1, 'steam');
      this.onChuff?.(c, effort);
    }
    // jets de vapeur des cylindres (démarrage, fort effort à petite vitesse)
    if (effort > 0.25 && speed < 6) {
      c.jet = (c.jet || 0) + dt * 10 * effort;
      while (c.jet >= 1) {
        c.jet -= 1;
        const s = Math.random() < 0.5 ? -1 : 1;
        inner.localToWorld(p.set(war ? 0.95 : 1.3, 0.22, s * 0.42));
        v.set(0, 0, 0).add(this.tmp.set((Math.random() - 0.5) * 1.2, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2));
        v.addScaledVector(this.tmp.set(-c.dir.z, 0, c.dir.x), s * 2.2);
        this.onSmoke(p, v, 0.7, 'jet');
      }
    }
  }
  // Phares (deux lumières pour les deux locomotives les plus proches) et feu rouge du dernier
  // véhicule ; plus visibles la nuit
  lights() {
    const night = Math.max(0, Math.min(1, this.night)), glow = 0.25 + 0.75 * night;
    const locos = [];
    for (const t of this.trains) {
      t.cars.forEach((c, i) => {
        const ud = c.mesh.userData;
        if (ud.tail) { ud.tail.visible = i === t.cars.length - 1 && t.cars.length > 0; this.M.halo.opacity = glow; }
        if (ud.beam) {
          ud.beam.material.opacity = 0.03 + 0.11 * night;
          ud.beam.visible = night > 0.05;
          locos.push(c);
        }
      });
    }
    locos.sort((a, b) => a.pos.distanceToSquared(this.view) - b.pos.distanceToSquared(this.view));
    this.spots.forEach((l, i) => {
      const c = locos[i];
      if (!c || night < 0.05) { l.intensity = 0; l.visible = false; return; }
      l.visible = true;
      l.intensity = 30 * night * (c.train.load?.light || 1);
      const inner = c.mesh.children[0];
      inner.localToWorld(l.position.set(1.55, 0.62, 0));
      inner.localToWorld(l.target.position.set(9, -0.6, 0));
      l.target.updateMatrixWorld();
    });
  }

  // ---------- Écran de bord ----------
  // Ce que montre l'écran de bord de la voiture c (on y est assis) : vitesse, pilote, combustible,
  // prochaine gare, prochain aiguillage, bout de la voie (en ligne : reçu de l'hôte)
  dash(c) {
    const t = c?.train;
    if (!t) return null;
    if (this.remote) return t.dashData || null;
    const L = this.limits(t), goal = this.target(t);
    const cab = this.back(t.head, CAB_OFF, t.trail) || t.head;
    const info = t.v < -0.05 ? { station: null, sw: null, end: null, sign: null } : this.tracks.ahead(cab, 400, { skip: t.wait > 0 ? null : t.lastStop, want: goal ? (st) => st.key === goal : null, skipSign: t.lastSign });
    const loco = locoOf(t), name = (k) => this.tracks.stations.find((st) => st.key === k)?.name || '?';
    return {
      v: t.v, vmax: L.vmax, auto: t.auto ? t.auto.v : null, wait: t.wait || 0,
      fuel: this.fuelOn() && L.power !== 'none' ? loco?.fuel ?? 0 : null, fuelMax: L.tank, power: L.power,
      station: info.station ? { name: info.station.st.name, dist: Math.max(0, info.station.dist) } : null,
      sw: info.sw ? { dist: info.sw.dist - CAB_OFF, branch: info.sw.branch } : null,
      end: info.end !== null ? info.end - CAB_OFF : null,
      sign: info.sign ? { kmh: info.sign.sg.kmh, dist: info.sign.dist } : null,
      limit: t.limit ? Math.round(t.limit * 3.6) : null,
      cars: t.cars.length, load: L.m, acc: L.acc, brake: L.brake, burn: L.burn, bonus: L.parts || [],
      engine: loco?.comps?.engine || 0, parts: loco?.comps ? [...loco.comps.parts] : [], style: loco?.style || '',
      route: (t.route || []).map((k) => ({ key: k, name: name(k) })), routeI: t.routeI || 0, routeLost: !!t.routeLost,
      tail: !!t.cars.find((c) => c.kind === 'tail'),
    };
  }

  // ---------- Visée ----------
  // Voiture touchée par le rayon (une boîte de 3 x 1,2 x 0,9 autour de la voiture)
  raycast(origin, dir, maxDist) {
    let best = null;
    const inv = new THREE.Matrix4(), o = new THREE.Vector3(), d = new THREE.Vector3(), box = new THREE.Box3(new THREE.Vector3(-1.55, 0.1, -0.46), new THREE.Vector3(1.55, 1.42, 0.46));
    const ray = new THREE.Ray(), hit = new THREE.Vector3();
    const low = new THREE.Box3(new THREE.Vector3(-1.55, 0.05, -0.46), new THREE.Vector3(1.55, 0.25, 0.46));
    for (const c of this.cars) {
      // (la voiture où l'on est assis, vue de l'intérieur : on ne la vise pas)
      if (this.riders(c).some((p) => p.firstPerson)) continue;
      if (c.pos.distanceToSquared(origin) > (maxDist + 2) ** 2) continue;
      inv.copy(c.mesh.matrixWorld).invert();
      ray.set(o.copy(origin).applyMatrix4(inv), d.copy(dir).transformDirection(inv));
      if (!ray.intersectBox(isDeckKind(c.kind) ? low : box, hit)) continue;
      const t = hit.applyMatrix4(c.mesh.matrixWorld).distanceTo(origin);
      if (t <= maxDist && (!best || t < best.t)) best = { cart: c, car: c, t }; // (cart : comme les Hexacarts, voir updateTarget)
    }
    return best;
  }

  // ---------- En ligne ----------
  // État envoyé par l'hôte : [id du train, [[id, sorte, x, y, z, qx, qy, qz, qw, conducteur (id du
  // joueur ou -1), places (wagon passagers : id des joueurs assis), remplissage (trémie)], ...],
  // écran de bord (si quelqu'un est à bord)]
  state(pidOf) {
    const r = (v) => Math.round(v * 1000) / 1000, rq = (v) => Math.round(v * 10000) / 10000;
    return this.trains.map((t) => {
      const cars = t.cars.map((c) => {
        const q = c.mesh.quaternion;
        return [c.id, c.kind, r(c.pos.x), r(c.pos.y), r(c.pos.z), rq(q.x), rq(q.y), rq(q.z), rq(q.w), c.rider ? pidOf(c.rider) : -1,
          c.seats ? c.seats.map((p) => (p ? (p.type ? -2 : pidOf(p)) : -1)) : 0, c.kind === 'hopper' ? Math.round((c.box.slots.filter(Boolean).length / CHEST_SLOTS) * 100) / 100 : c.kind === 'layer' ? c.arm || 0 : c.kind === 'armored' && c.aim ? c.aim.map((v) => Math.round(v * 100) / 100) : 0, c.style || ''];
      });
      const aboard = t.cars.some((c) => this.riders(c).length);
      return aboard ? [t.id, cars, this.dash(t.cars[0])] : [t.id, cars];
    });
  }
  // Invité : les voitures affichées suivent l'état reçu (créées, déplacées, enlevées)
  applyState(list, myPid, player) {
    const seen = new Set();
    for (const e of list) {
      if (!Array.isArray(e) || !Number.isInteger(e[0]) || !Array.isArray(e[1])) continue;
      let t = this.trains.find((x) => x.id === e[0]);
      if (!t) { t = { id: e[0], cars: [], v: 0 }; this.trains.push(t); }
      t.dashData = e[2] && typeof e[2] === 'object' ? e[2] : null;
      const keep = [];
      for (const d of e[1].slice(0, 1000)) {
        if (!Array.isArray(d) || d.length < 10 || !d.slice(2, 9).every(Number.isFinite)) continue;
        const [id, kind, x, y, z, qx, qy, qz, qw, rider, seats, extra, st] = d;
        if (!KINDS.includes(kind)) continue;
        const style = STYLES[st] ? st : '';
        let c = t.cars.find((o) => o.id === id && o.kind === kind);
        if (!c) {
          c = { id, kind, train: t, owner: this, isTrain: true, rider: null, seats: kind === 'passenger' ? new Array(SEATS.length).fill(null) : null, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0), v: 0, mesh: this.model(kind, style), style, target: new THREE.Vector3(), tquat: new THREE.Quaternion() };
          c.mesh.position.set(x, y, z);
          c.mesh.quaternion.set(qx, qy, qz, qw).normalize();
          this.scene.add(c.mesh);
        }
        c.target.set(x, y, z);
        c.tquat.set(qx, qy, qz, qw).normalize();
        c.riderPid = rider;
        if (kind === 'hopper') c.fill = Number(extra) || 0;
        if (kind === 'layer') c.arm = Number(extra) || 0;
        if (kind === 'armored' && Array.isArray(extra) && extra.length === 2 && extra.every(Number.isFinite)) c.aim = extra;
        // (quelqu'un d'autre a pris la cabine, ou notre place : on n'y est plus)
        if (player.riding === c && (kind === 'loco' || kind === 'armored') && rider !== myPid && rider >= 0) { player.riding = null; c.rider = null; }
        if (c.seats && Array.isArray(seats)) {
          c.seatPids = seats;
          if (player.riding === c && Number.isInteger(player.seat) && seats[player.seat] !== myPid && seats[player.seat] >= 0) { c.seats[player.seat] = null; player.riding = null; }
        }
        keep.push(c);
      }
      for (const c of t.cars) if (!keep.includes(c)) { this.scene.remove(c.mesh); if (player.riding === c) player.riding = null; }
      t.cars = keep;
      seen.add(t.id);
    }
    for (const t of [...this.trains]) {
      if (seen.has(t.id)) continue;
      for (const c of t.cars) { this.scene.remove(c.mesh); if (player.riding === c) player.riding = null; }
      this.trains = this.trains.filter((x) => x !== t);
    }
  }
  // Invité : les voitures glissent vers leur dernière position connue ; on est assis dans la
  // cabine (ou sur sa place) si on y est monté
  updateRemote(dt, player) {
    const k = 1 - Math.exp(-dt * 15), prev = new THREE.Vector3();
    for (const t of this.trains) for (const c of t.cars) {
      if (!c.target) continue;
      prev.copy(c.pos);
      if (c.pos.distanceToSquared(c.target) > 36) c.pos.copy(c.target); else c.pos.lerp(c.target, k);
      c.mesh.quaternion.slerp(c.tquat, k);
      c.mesh.position.copy(c.pos);
      c.dir.set(1, 0, 0).applyQuaternion(c.mesh.quaternion);
      c.vel.subVectors(c.pos, prev).divideScalar(Math.max(dt, 1e-3));
      const yaw = Math.atan2(-c.dir.x, -c.dir.z);
      if (player.riding === c) {
        this.seatOf(c, player.pos, c.seats ? player.seat : -1);
        player.vel.set(0, 0, 0);
        if (c.yaw0 !== null && c.yaw0 !== undefined) player.yaw += wrap(yaw - c.yaw0);
      }
      c.yaw0 = yaw;
    }
    if (!player.riding) this.pushPlayer(player);
  }
  byId(id) { return this.cars.find((c) => c.id === id) || null; }
  // Place d'un joueur à bord (ses pieds) : le siège du conducteur dans la cabine, ou la place
  // seat du wagon passagers
  seatOf(c, out, seat = -1) {
    if (c.kind === 'passenger') {
      const [x, z] = SEATS[Math.max(0, Math.min(SEATS.length - 1, seat | 0))];
      const sx = -c.dir.z, sz = c.dir.x, n = Math.hypot(sx, sz) || 1;
      return out.set(c.pos.x + c.dir.x * x * SC + (sx / n) * z * SC, c.pos.y + 0.62 * SC - 0.48, c.pos.z + c.dir.z * x * SC + (sz / n) * z * SC);
    }
    // (vapeur : debout dans la cabine, à l'arrière, sur le plancher surélevé)
    const steam = isSteam(c);
    // (wagon blindé : assis sur la tourelle avant, la tête au-dessus de la trappe)
    if (c.kind === 'armored') return out.set(c.pos.x + c.dir.x * GUN_X * SC, c.pos.y + 1.47 * SC - 1.62, c.pos.z + c.dir.z * GUN_X * SC);
    const along = (c.kind === 'tail' ? -0.74 : steam ? -1.08 : 0.74) * SC;
    return out.set(c.pos.x + c.dir.x * along, c.pos.y + (steam ? 0.865 : 0.62) * SC - 0.48, c.pos.z + c.dir.z * along);
  }

  // ---------- Sauvegarde ----------
  serialize() {
    const cp = (st) => (st ? { id: st.id, n: st.n, ...(st.w ? { w: st.w } : {}) } : null);
    return this.trains.map((t) => ({
      e: t.head.e.key, s: t.head.s, rev: t.head.rev, v: t.v, trail: t.trail.slice(0, 300),
      ...(t.auto ? { auto: t.auto.v } : {}), ...(t.wait ? { wait: t.wait } : {}), ...(t.lastStop ? { last: t.lastStop } : {}),
      ...(t.route?.length ? { route: t.route, routeI: t.routeI || 0 } : {}), ...(t.limit ? { limit: t.limit, lastSign: t.lastSign } : {}),
      cars: t.cars.map((c) => (c.box ? { k: c.kind, slots: c.box.slots.map(cp) } : c.deck ? { k: c.kind, id: c.deck.id, deck: c.deck.list } : c.kind === 'loco' ? { k: 'loco', fuel: Math.round(c.fuel || 0), comps: c.comps, ...(c.style ? { style: c.style } : {}) } : c.kind)),
    }));
  }
  load(list) {
    this.clear();
    this.tracks.rebuild();
    for (const d of list || []) {
      const e = typeof d.e === 'string' && this.tracks.edges.get(d.e);
      const kindOf = (c) => (typeof c === 'string' ? c : c?.k);
      if (!e || !Number.isFinite(d.s) || !Array.isArray(d.cars) || !d.cars.length) continue; // (une rame dételée : sans locomotive)
      const trail = Array.isArray(d.trail) ? d.trail.filter((k) => typeof k === 'string').slice(0, 600) : [];
      const train = { id: this.nextId++, cars: [], head: { e, s: Math.max(0, Math.min(e.L, d.s)), rev: !!d.rev }, v: Number(d.v) || 0, trail, ver: this.tracks.version };
      if (Number.isFinite(d.auto) && d.auto > 0) train.auto = { v: Math.min(90, d.auto) };
      if (Number.isFinite(d.wait) && d.wait > 0) train.wait = Math.min(STOP_TIME, d.wait);
      if (typeof d.last === 'string') train.lastStop = d.last;
      if (Array.isArray(d.route)) { train.route = d.route.filter((k) => typeof k === 'string').slice(0, 64); train.routeI = Number.isInteger(d.routeI) ? d.routeI : 0; }
      if (Number.isFinite(d.limit) && d.limit > 0) { train.limit = d.limit; if (typeof d.lastSign === 'string') train.lastSign = d.lastSign; }
      for (const k of d.cars.slice(0, 1000)) {
        let kd = kindOf(k);
        if (!KINDS.includes(kd)) kd = 'wagon';
        const deck = isDeckKind(kd) && Array.isArray(k.deck) ? k.deck.filter((b) => Array.isArray(b) && b.length === 4 && b.every(Number.isInteger) && BLOCKS[b[3]]).slice(0, 4000) : null;
        const car = this.makeCar(train, kd, deck, Number(k?.id) || 0, kd === 'loco' ? k?.style : '');
        if (kd === 'loco' && k?.comps && typeof k.comps === 'object') {
          // (composants vérifiés : un moteur à sa place, des composants aux leurs)
          const e = compOf(k.comps.engine);
          car.comps.engine = e?.slot === 'engine' ? k.comps.engine : 0;
          if (Array.isArray(k.comps.parts)) for (let i = 0; i < PART_SLOTS; i++) car.comps.parts[i] = compOf(k.comps.parts[i])?.slot === 'part' ? k.comps.parts[i] : 0;
        }
        if (kd === 'loco' && Number.isFinite(k?.fuel)) car.fuel = Math.max(0, k.fuel);
        // (le chargement du wagon, vérifié)
        if (car.box && Array.isArray(k?.slots)) for (let i = 0; i < CHEST_SLOTS; i++) {
          const st = k.slots[i];
          car.box.slots[i] = st && Number.isInteger(st.id) && (BLOCKS[st.id] || ITEMS[st.id]) && Number.isInteger(st.n) && st.n > 0 ? makeSlot(st.id, Math.min(st.n, ITEMS[st.id]?.stack ?? 64), st.w) : null;
        }
        train.cars.push(car);
      }
      this.trains.push(train);
      this.placeCars(train);
    }
  }
}
