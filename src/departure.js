// La fin du tutoriel : on monte dans la navette du hangar de la station Hexa-Zéro et elle part
// pour de vrai, dans le monde : les moteurs s'allument, elle décolle, la grande baie vitrée du
// hangar s'ouvre (les blocs disparaissent), elle sort de la station, file dans l'espace et saute
// en hyperespace (éclair blanc). Puis noir, quelques mots, le titre, et retour au menu.
// Même principe que crash.js : le jeu appelle update(dt) puis apply(camera) à chaque image.
import * as THREE from 'three';
import { hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { hexPrism, Particles } from './intro.js?v=1.1.5-alpha-mvm2b95g';
import { injectStyle, grabKeys } from './crash.js?v=1.1.5-alpha-mvm2b95g';
import { BLOCKS, AIR } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { playDoor, playExplosion, playAlarm } from './sound.js?v=1.1.5-alpha-mvm2b95g';

const smooth = (a, b, t) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const rr = (a, b) => a + Math.random() * (b - a);
const pick = (l) => l[Math.floor(Math.random() * l.length)];
const rand3 = (k) => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(k);

// Moments (secondes)
const LIFT = 1.4, DOOR = 3, GO = 4.2, JUMP = 12.3, END = 19;
const CAPS = [
  [0.4, 3, 'ORA : Navette d\'entraînement prête. Moteurs allumés.'],
  [3.1, 6.6, 'ORA : Ouverture de la baie du hangar… Bon vol, cadet.'],
  [7.2, 11.8, 'ORA : Le HEXA-7 t\'attend. Ta formation est terminée.'],
  [13.4, 16, 'Ta véritable aventure commence maintenant…'],
];

// world : le monde ; atlas : les textures ; at : { x, z, y } (centre de la navette, y = son
// plancher) ; end : x de la baie vitrée du hangar ; onEnd() : fin (ou passée)
export function playDeparture({ scene, world, atlas, at, end, onEnd = () => {} }) {
  // ---------- la navette : ses blocs quittent le monde et deviennent un objet ----------
  const c = worldToHex(at.x, at.z), cw = hexToWorld(c.q, c.r);
  const blocks = [];
  for (let dr = -2; dr <= 2; dr++) {
    for (let dq = -2; dq <= 2; dq++) {
      if (Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) > 2) continue;
      for (let y = at.y; y <= at.y + 5; y++) {
        const id = world.getBlock(c.q + dq, c.r + dr, y);
        if (!id || !BLOCKS[id] || BLOCKS[id].torch) continue;
        blocks.push([dq, dr, y - at.y, id]);
        world.setBlock(c.q + dq, c.r + dr, y, AIR);
      }
    }
  }
  const texCache = new Map(), mats = new Map();
  const tex = (name) => {
    if (!texCache.has(name)) {
      const img = atlas?.tiles?.[name];
      let t = null;
      if (img) { t = new THREE.CanvasTexture(img); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; }
      texCache.set(name, t);
    }
    return texCache.get(name);
  };
  const matsOf = (id) => {
    if (!mats.has(id)) {
      const b = BLOCKS[id], glow = id === 67 || id === 95, M = glow ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
      const o = id === 40 ? { transparent: true, opacity: 0.5, depthWrite: false } : {};
      const m = (n) => { const t = tex(n); return t ? new M({ map: t, ...o }) : new M({ color: 0x8a8a8a, ...o }); };
      mats.set(id, [m(b.side), m(b.top + '_cap'), m(b.bottom + '_cap')]);
    }
    return mats.get(id);
  };
  const geo = hexPrism(1 / Math.sqrt(3), 1);
  const ship = new THREE.Group(), body = new THREE.Group();
  ship.add(body);
  for (const [q, r, y, id] of blocks) {
    const w = hexToWorld(q, r), m = new THREE.Mesh(geo, matsOf(id));
    m.position.set(w.x, y, w.z);
    body.add(m);
  }
  // (la lueur des moteurs éclaire la navette et le hangar)
  const glow = new THREE.PointLight(0x6ad8ff, 0, 18, 1.5);
  glow.position.set(-2, 1.4, 0);
  ship.add(glow);
  const P0 = new THREE.Vector3(cw.x, at.y, cw.z);
  ship.position.copy(P0);
  scene.add(ship);
  const fireP = new Particles(scene, 1400, true), smokeP = new Particles(scene, 500, false);

  // ---------- écran : bandes noires, sous-titres, voile ----------
  injectStyle();
  const root = document.createElement('div');
  root.id = 'crash';
  root.innerHTML = `<div class="veil bars" style="opacity:1"></div><div class="veil flash"></div><div class="veil black"></div>
    <div class="caption"></div><div class="skip">Clic, Échap ou Espace : passer</div>
    <div class="title"><h1>Hexa<span>Craft</span></h1><p>Survivre. Explorer. Reconstruire.</p></div>`;
  document.body.appendChild(root);
  const caption = root.querySelector('.caption'), flash = root.querySelector('.flash'), black = root.querySelector('.black'), title = root.querySelector('.title');

  // ---------- la baie du hangar qui s'ouvre ----------
  let doorOpen = false;
  const openDoor = () => {
    doorOpen = true;
    const a = worldToHex(end - 1, -6), b = worldToHex(end + 3, 6);
    for (let r = a.r - 1; r <= b.r + 1; r++) {
      for (let q = a.q - 4; q <= b.q + 4; q++) {
        const w = hexToWorld(q, r);
        if (w.x < end || w.x > end + 2 || Math.abs(w.z) > 4.6) continue;
        for (let y = at.y; y <= at.y + 6; y++) if (world.getBlock(q, r, y) === 40) world.setBlock(q, r, y, AIR);
      }
    }
    try { playDoor(); } catch { /* (son indisponible) */ }
  };

  // ---------- trajectoire ----------
  const P = P0.clone(), prev = P0.clone(), vel = new THREE.Vector3();
  let t = 0, finished = false, boomed = false, jumped = false, alarmT = 0;
  const posAt = (s) => {
    const p = P0.clone();
    p.y += smooth(LIFT, GO, s) * 2.6;
    if (s > GO) {
      const u = s - GO;
      p.x += 1.6 * u * u;                       // elle accélère vers la baie, puis l'espace
      p.y += smooth(GO + 2, GO + 8, s) * 14;    // et prend un peu de hauteur une fois dehors
      p.z += smooth(GO + 3, GO + 8, s) * -10;
    }
    return p;
  };
  const step = (dt) => {
    t += dt;
    prev.copy(P);
    P.copy(posAt(t));
    if (t > JUMP) P.x += (t - JUMP) ** 2 * 900; // (le saut : elle part d'un coup)
    vel.subVectors(P, prev).divideScalar(Math.max(dt, 1e-3));
    ship.position.copy(P);
    // tremblement au démarrage, inclinaison dans le virage
    const shake = t < GO ? smooth(0.2, LIFT, t) * 0.04 : 0.01;
    body.position.set(rr(-shake, shake), rr(-shake, shake), rr(-shake, shake));
    ship.rotation.set(-smooth(GO + 3, GO + 6, t) * 0.25 * (1 - smooth(GO + 6, GO + 8, t)), 0, smooth(GO + 2, GO + 6, t) * 0.12);
    // étirement du saut en hyperespace
    ship.scale.set(1 + smooth(JUMP - 0.3, JUMP + 0.15, t) * 25, 1, 1);
    // moteurs : la lueur, puis les flammes bleues qui sortent à l'arrière (vers l'ouest)
    const power = smooth(0.2, LIFT, t) * 0.5 + smooth(GO - 0.3, GO + 0.6, t) * 0.5;
    glow.intensity = power * 9;
    const n = Math.round(1 + power * 4);
    for (const sz of [0.75, -0.75]) {
      for (let i = 0; i < n; i++) {
        const back = new THREE.Vector3(-rr(5, 12) * (0.3 + power), rr(-0.3, 0.3), rr(-0.3, 0.3));
        fireP.spawn(P.clone().add(new THREE.Vector3(-0.9, 1.5, sz)).add(rand3(0.3)), back.add(vel.clone().multiplyScalar(0.6)), rr(0.15, 0.35), pick(['#5ab8ff', '#3a8cff', '#9ae6ff', '#ffb070']), rr(0.4, 1.1) * (0.5 + power), -1.5);
      }
    }
    // la poussière du hangar soufflée au décollage
    if (t > LIFT && t < GO + 1 && Math.random() < 0.35) {
      const a = Math.random() * Math.PI * 2;
      smokeP.spawn(P0.clone().add(new THREE.Vector3(Math.cos(a) * 2, 0.3, Math.sin(a) * 2)), new THREE.Vector3(Math.cos(a) * rr(1.5, 3), rr(0.1, 0.6), Math.sin(a) * rr(1.5, 3)), rr(0.8, 1.4), pick(['#9aa0a8', '#7a808a']), rr(0.6, 1.2), 1, 1);
    }
    if (!doorOpen && t > DOOR) openDoor();
    // l'alarme de la baie qui s'ouvre
    if (t > DOOR - 0.6 && t < GO + 1 && t - alarmT > 0.8) { alarmT = t; try { playAlarm(); } catch { /* (son indisponible) */ } }
    if (!boomed && t > GO) { boomed = true; try { playExplosion(14, false); } catch { /* (son indisponible) */ } }
    if (!jumped && t > JUMP) { jumped = true; try { playExplosion(40, true); } catch { /* (son indisponible) */ } }
  };

  // ---------- caméra ----------
  const cam = new THREE.Vector3(), look = new THREE.Vector3(), lookS = P0.clone();
  let camRef = null, baseFov = 75;
  const shot = () => {
    if (t < GO + 0.2) {
      // 1. dans le hangar, à côté de la navette qui s'éveille (on s'approche doucement)
      const k = smooth(0, GO, t);
      cam.set(P0.x - 6 + k * 1.5, P0.y + 2.4 + k * 0.6, P0.z + 7 - k * 1.5);
      look.set(P.x + 1, P.y + 1.6, P.z);
    } else if (t < 7.6) {
      // 2. derrière elle : elle fonce vers la baie ouverte et sort dans l'espace
      cam.copy(P).add(new THREE.Vector3(-9 - (t - GO) * 1.2, 3.2, 2.5));
      look.copy(P).add(new THREE.Vector3(8, 1, 0));
    } else {
      // 3. dehors, dans le vide : la station derrière, la navette passe et s'éloigne
      cam.set(end + 52, P0.y + 9, P0.z + 16);
      look.copy(t < JUMP ? P : posAt(JUMP)).add(new THREE.Vector3(0, 1.5, 0));
    }
  };

  const cleanup = () => {
    scene.remove(ship, fireP.points, smokeP.points);
    geo.dispose();
    fireP.geo.dispose(); smokeP.geo.dispose(); fireP.points.material.dispose(); smokeP.points.material.dispose();
    for (const ms of mats.values()) ms.forEach((m) => m.dispose());
    for (const tx of texCache.values()) tx?.dispose();
    release();
    root.remove();
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    if (!doorOpen) openDoor();
    cleanup();
    api.active = false;
    if (camRef) { camRef.fov = baseFov; camRef.updateProjectionMatrix(); }
    onEnd();
  };
  const release = grabKeys(finish);
  root.addEventListener('pointerdown', () => { if (t > 0.5) finish(); });

  const api = {
    active: true,
    update(dt) {
      if (finished) return;
      step(dt);
      fireP.update(dt);
      smokeP.update(dt);
      shot();
      lookS.lerp(look, 1 - Math.exp(-dt * (t < GO ? 4 : 9)));
      const cap = CAPS.find(([a, b]) => t >= a && t < b);
      caption.textContent = cap ? cap[2].slice(0, Math.floor((t - cap[0]) * 40)) : '';
      caption.style.opacity = cap ? 1 - smooth(cap[1] - 0.4, cap[1], t) : 0;
      caption.style.color = cap && t > JUMP ? '#e8eef4' : '';
      flash.style.opacity = smooth(JUMP - 0.15, JUMP + 0.1, t) * (1 - smooth(JUMP + 0.3, JUMP + 1.3, t));
      black.style.opacity = Math.max(1 - smooth(0, 0.8, t), smooth(JUMP + 0.3, JUMP + 0.8, t));
      title.style.opacity = smooth(16.2, 17.2, t) * (1 - smooth(END - 0.6, END, t));
      if (t > END) finish();
    },
    apply(camera) {
      if (finished) return;
      if (!camRef) { camRef = camera; baseFov = camera.fov; }
      camera.position.copy(cam);
      if (t > GO && t < GO + 0.5) camera.position.add(rand3(0.35)); // (le départ secoue tout)
      camera.lookAt(lookS);
      // (dehors : un léger zoom qui suit la navette)
      camera.fov = baseFov - (t > 7.6 ? smooth(7.6, 11, t) * 25 : 0);
      camera.updateProjectionMatrix();
    },
    skip: finish,
  };
  return api;
}
