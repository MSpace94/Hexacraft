// L'écrasement du HEXA-7, pour de vrai, dans le monde (après la cinématique, la première fois
// dans un monde neuf). La cinématique (intro.js) s'arrête dans l'atmosphère ; ici le vaisseau
// (le même, en blocs, moins l'aile perdue dans la ceinture d'astéroïdes) arrive du ciel en
// flammes sur le vrai terrain du monde : il fauche les arbres sur son passage, touche le sol,
// rebondit, laboure tout ce qui dépasse sous lui (les blocs disparaissent vraiment), ralentit
// d'autant plus qu'il pousse de terre (une colline l'arrête net, une pente le fait glisser plus
// loin, l'eau le freine moins), perd des blocs qui retombent autour, puis s'immobilise. L'épave
// est alors posée à sa place en vrais blocs (voir buildWreck dans main.js). Chaque monde a donc
// son propre écrasement : relief, arbres, eau, direction d'arrivée (une des six directions de
// la grille) et angle de descente.
// Puis noir, battements de cœur, « Cliquer pour ouvrir les yeux » (wakeScreen).
// Le jeu continue de dessiner le monde : il appelle update(dt) puis apply(camera) à chaque image.
import * as THREE from 'three';
import { BLOCKS, SUPPORT, AIR } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { hexToWorld, worldToHex, NEIGHBORS } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { H, Y_MIN } from './mesher.js?v=1.1.5-alpha-mvm2b95g';
import { shipBlocks, podBlocks, hexPrism, Particles } from './intro.js?v=1.1.5-alpha-mvm2b95g';
import { playExplosion, playThunder, playHeartbeat } from './sound.js?v=1.1.5-alpha-mvm2b95g';

const UP = new THREE.Vector3(0, 1, 0);
const smooth = (a, b, t) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const rr = (a, b) => a + Math.random() * (b - a);
const rand3 = (k) => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(k);
const pick = (l) => l[Math.floor(Math.random() * l.length)];

// Tourne une case (q, r) de k fois 60° autour de (0, 0)
export function rotHex(q, r, k) {
  for (let i = 0; i < ((k % 6) + 6) % 6; i++) [q, r] = [-r, q + r];
  return [q, r];
}

// ---------- Interface : bandes noires, voile, textes, écran du réveil ----------
export function injectStyle() {
  if (document.getElementById('crash-style')) return;
  const st = document.createElement('style');
  st.id = 'crash-style';
  st.textContent = `
  #crash { position: fixed; inset: 0; z-index: 190; cursor: pointer; user-select: none; font-family: 'Segoe UI', system-ui, sans-serif; }
  #crash .bars::before, #crash .bars::after { content: ''; position: absolute; left: 0; right: 0; height: 7vh; background: #000; }
  #crash .bars::before { top: 0; } #crash .bars::after { bottom: 0; }
  #crash .veil { position: absolute; inset: 0; pointer-events: none; opacity: 0; }
  #crash .black { background: #000; }
  #crash .flash { background: #fff; }
  #crash .caption { position: absolute; left: 50%; bottom: 10%; transform: translateX(-50%); width: min(880px, calc(100% - 32px)); text-align: center;
    color: #9aa4b0; font-style: italic; font-size: clamp(16px, 2.2vw, 25px); font-weight: 500; text-shadow: 0 2px 10px #000; min-height: 2.8em; }
  #crash .skip { position: absolute; top: calc(7vh + 10px); right: 18px; color: rgba(255, 255, 255, 0.5); font-size: 13px; }
  #crash .title { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; opacity: 0; pointer-events: none; }
  #crash .title h1 { margin: 0; font-size: clamp(42px, 8vw, 96px); font-weight: 800; letter-spacing: 2px; color: #fff; text-shadow: 0 4px 24px rgba(60, 220, 255, 0.45), 0 2px 6px #000; }
  #crash .title h1 span { color: #5fd35f; }
  #crash .title p { margin: 0; color: #c8d2dc; font-size: clamp(16px, 2.4vw, 26px); font-weight: 600; }
  #crash .title small { color: #fff; font-size: 16px; font-weight: 600; animation: crashBlink 1.4s ease-in-out infinite; }
  @keyframes crashBlink { 50% { opacity: 0.35; } }`;
  document.head.appendChild(st);
}
// (les touches ne vont pas au jeu pendant la scène ; Échap, Espace, Entrée : passer / continuer)
export function grabKeys(onSkip) {
  const h = (e) => {
    e.stopImmediatePropagation();
    if (['Escape', 'Space', 'Enter', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); if (e.type === 'keydown') onSkip(); }
  };
  addEventListener('keydown', h, true);
  addEventListener('keyup', h, true);
  return () => { removeEventListener('keydown', h, true); removeEventListener('keyup', h, true); };
}

// Écran noir du réveil : quelques mots, des battements de cœur, le titre, puis « Cliquer pour
// ouvrir les yeux » (le clic permet au jeu de reprendre la souris). onEnd() au clic.
export function wakeScreen(onEnd) {
  injectStyle();
  const root = document.createElement('div');
  root.id = 'crash';
  root.innerHTML = `<div class="veil black" style="opacity:1"></div><div class="caption"></div>
    <div class="title"><h1>Hexa<span>Craft</span></h1><p>Survivre. Explorer. Reconstruire.</p><small></small></div>`;
  document.body.appendChild(root);
  const caption = root.querySelector('.caption'), title = root.querySelector('.title'), prompt = root.querySelector('small');
  const lines = [[0.6, 2.6, '…'], [3, 6.5, pick(['Une odeur de brûlé. Le craquement du métal qui refroidit.', 'Le silence. Puis le vent dans l\'herbe.', 'Des grésillements. Une lampe de secours qui clignote.'])]];
  const start = performance.now();
  let t = 0, beat = -1, raf = 0, done = false;
  const end = () => {
    t = (performance.now() - start) / 1000;
    if (done || t < 1) return;
    done = true;
    cancelAnimationFrame(raf);
    release();
    root.remove();
    onEnd();
  };
  const release = grabKeys(end);
  root.addEventListener('pointerdown', end);
  const frame = () => {
    raf = requestAnimationFrame(frame);
    t = (performance.now() - start) / 1000;
    const c = lines.find(([a, b]) => t >= a && t < b);
    caption.textContent = c ? c[2].slice(0, Math.floor((t - c[0]) * 42)) : '';
    caption.style.opacity = c ? 1 - smooth(c[1] - 0.5, c[1], t) : 0;
    title.style.opacity = smooth(1.2, 3, t);
    prompt.textContent = t < 1 ? '' : 'Cliquer pour ouvrir les yeux';
    if (t > 0.6 && t - beat > 1.25) { beat = t; try { playHeartbeat(0.35); } catch { /* (son indisponible) */ } }
  };
  frame();
}

// Joue l'écrasement. center : là où l'on apparaît (l'épave finira à peu près là) ; side : le
// côté de l'aile perdue (1 droite, -1 gauche) ; onRest({ q, r, y, rot, debris }) : l'épave
// s'est arrêtée (case du vaisseau, hauteur du plancher, rotation en sixièmes de tour, blocs
// tombés [[q, r, y, id]]) ; onEnd() : réveil (au clic, après l'écran noir).
export function playCrash({ scene, world, atlas, side = 1, center, onRest = () => {}, onEnd = () => {} }) {
  injectStyle();
  const root = document.createElement('div');
  root.id = 'crash';
  root.innerHTML = `<div class="veil bars" style="opacity:1"></div><div class="veil flash"></div><div class="veil black" style="opacity:1"></div><div class="skip">Clic, Échap ou Espace : passer</div>`;
  document.body.appendChild(root);
  const flash = root.querySelector('.flash'), black = root.querySelector('.black');

  // ---------- Le terrain du monde ----------
  const soft = (id) => { const b = BLOCKS[id]; return !!(b && (b.leaves || b.log || b.sapling || b.torch || id === 196 || id === 37)); };
  const blocking = (id) => SUPPORT[id] && !soft(id);
  const groundAt = (x, z, from = H - 2) => { // (le sol sous (x, z), sous la hauteur from : ni feuilles ni troncs)
    const { q, r } = worldToHex(x, z);
    for (let y = Math.min(H - 2, Math.floor(from)); y > Y_MIN; y--) if (blocking(world.getBlock(q, r, y))) return y;
    return 0;
  };
  const topAt = (x, z) => { // (le plus haut bloc de la colonne, arbres compris)
    const { q, r } = worldToHex(x, z);
    for (let y = H - 2; y > Y_MIN; y--) if (world.getBlock(q, r, y) !== AIR) return y;
    return 0;
  };
  const isWater = (id) => !!BLOCKS[id]?.liquid;
  // la surface pour le vaisseau : le sol, ou l'eau (il glisse dessus, il ne coule pas)
  const surfaceAt = (x, z, from = H - 2) => {
    const { q, r } = worldToHex(x, z);
    for (let y = Math.min(H - 2, Math.floor(from)); y > Y_MIN; y--) { const id = world.getBlock(q, r, y); if (blocking(id) || isWater(id)) return y; }
    return 0;
  };
  const wet = (x, z) => { const { q, r } = worldToHex(x, z); return isWater(world.getBlock(q, r, surfaceAt(x, z))); };
  const C = new THREE.Vector3(center.x, 0, center.z);
  // d'où il arrive : une des six directions de la grille, de préférence celle où il glisse sur
  // la terre ferme (on regarde où il toucherait et où il glisserait)
  const nose = worldToHex(0, -20);
  const dirOf = (k) => { const [nq, nr] = rotHex(nose.q, nose.r, k), nw = hexToWorld(nq, nr); return new THREE.Vector3(nw.x, 0, nw.z).normalize(); };
  const score = (k) => { const d = dirOf(k); let n = Math.random(); for (let a = -50; a <= 30; a += 5) if (wet(C.x + d.x * a, C.z + d.z * a)) n += 1; return n; };
  const rot = [0, 1, 2, 3, 4, 5].map((k) => [k, score(k)]).sort((a, b) => a[1] - b[1])[0][0];

  // ---------- Le vaisseau (le même qu'en orbite, tourné d'un sixième de tour au hasard) ----------
  const lost = side > 0 ? 'wing+' : 'wing-';
  const list = shipBlocks().filter(([, , , , part]) => part !== lost && !(part === 'hull' && Math.random() < 0.04));
  const dir = dirOf(rot);                                           // sens de la marche (le nez)
  const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
  const texCache = new Map(), matCache = new Map();
  const tex = (name) => {
    if (!texCache.has(name)) {
      const img = atlas?.tiles?.[name];
      let t = null;
      if (img) { t = new THREE.CanvasTexture(img); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; }
      texCache.set(name, t);
    }
    return texCache.get(name);
  };
  const GLOW = new Set([95, 67, 242]);
  const matsOf = (id) => {
    if (!matCache.has(id)) {
      const b = BLOCKS[id], M = GLOW.has(id) ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
      const o = id === 40 ? { transparent: true, opacity: 0.45, depthWrite: false } : {};
      const m = (n) => { const t = tex(n); return t ? new M({ map: t, ...o }) : new M({ color: 0x8a8a8a, ...o }); };
      matCache.set(id, [m(b.side), m(b.top + '_cap'), m(b.bottom + '_cap')]);
    }
    return matCache.get(id);
  };
  const geo = hexPrism(1 / Math.sqrt(3), 1);
  const ship = new THREE.Group();
  const byId = new Map();
  const blocks = list.map(([q, r, y, id, part]) => {
    const [a, b] = rotHex(q, r, rot), w = hexToWorld(a, b);
    if (!byId.has(id)) byId.set(id, []);
    const bl = { id, part, local: new THREE.Vector3(w.x, y, w.z), slot: byId.get(id).length, alive: true };
    byId.get(id).push(bl);
    return bl;
  });
  const meshes = new Map(), m4 = new THREE.Matrix4();
  for (const [id, bl] of byId) {
    const m = new THREE.InstancedMesh(geo, matsOf(id), bl.length);
    bl.forEach((b) => m.setMatrixAt(b.slot, m4.makeTranslation(b.local.x, b.local.y, b.local.z)));
    m.frustumCulled = false;
    ship.add(m);
    meshes.set(id, m);
  }
  scene.add(ship);
  const fireP = new Particles(scene, 2000, true), smokeP = new Particles(scene, 2400, false);

  // ---------- La trajectoire : d'où il arrive, où il touche (le terrain décide du reste) ----------
  const T = C.clone().addScaledVector(dir, -rr(18, 30)).addScaledVector(right, rr(-6, 6)); // (là où il devrait toucher)
  T.y = surfaceAt(T.x, T.z) + 2;
  const FLIGHT = rr(6.5, 8), DROP = rr(90, 150), RUN = rr(420, 520);
  const P = T.clone().addScaledVector(dir, -RUN); P.y = T.y + DROP;
  const G = 3; // (un peu de gravité : la courbe s'infléchit)
  const vel = new THREE.Vector3().subVectors(T, P).divideScalar(FLIGHT); vel.y += 0.5 * G * FLIGHT;
  let phase = 'fly', t = 0, contactAt = 0, restAt = 0, bounced = false, pitch = 0, roll = 0, slew = rr(-0.25, 0.25), shake = 0, sweepTick = 0, rumble = 0, inWater = false;
  const slewDir = Math.sign(slew) || 1;
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion();
  const orient = () => {
    qa.setFromAxisAngle(UP, slew);
    qb.setFromAxisAngle(right, -pitch);
    qc.setFromAxisAngle(dir, roll);
    ship.quaternion.copy(qa).multiply(qb).multiply(qc);
    ship.position.copy(P);
    ship.updateMatrixWorld();
  };
  orient();

  // blocs arrachés : ils tombent, rebondissent et restent là où ils s'arrêtent (de vrais blocs, à la fin)
  const debris = [];
  const throwBlock = (b, v) => {
    b.alive = false;
    const im = meshes.get(b.id);
    im.setMatrixAt(b.slot, m4.makeScale(0, 0, 0));
    im.instanceMatrix.needsUpdate = true;
    const d = new THREE.Mesh(geo, im.material);
    d.position.copy(b.local).applyMatrix4(ship.matrixWorld);
    d.quaternion.copy(ship.quaternion);
    scene.add(d);
    debris.push({ m: d, b, v, w: rand3(10), still: false });
  };
  const tear = (n) => {
    const cand = blocks.filter((b) => b.alive && (b.part === 'hull' || b.part === 'glass' || b.part === 'wing+' || b.part === 'wing-' || b.part === 'engine'));
    for (let k = 0; k < n && cand.length; k++) {
      const b = cand.splice(Math.floor(Math.random() * cand.length), 1)[0];
      throwBlock(b, vel.clone().multiplyScalar(rr(0.3, 0.8)).add(rand3(14)).add(new THREE.Vector3(0, rr(4, 10), 0)));
    }
  };

  // Ce que le vaisseau touche : feuilles et troncs fauchés en vol ; au sol, tout ce qui dépasse
  // sous lui est labouré (à partir de la hauteur du plancher, minY : le ventre repose sur ce qui
  // reste). Renvoie le nombre de blocs durs poussés (ils le freinent).
  const wp = new THREE.Vector3();
  const sweep = (plow, fast, minY = -1) => {
    let hard = 0, fx = 0;
    const seen = new Set();
    for (const b of blocks) {
      if (!b.alive) continue;
      wp.set(b.local.x, b.local.y + 0.5, b.local.z).applyMatrix4(ship.matrixWorld);
      const { q, r } = worldToHex(wp.x, wp.z), y = Math.floor(wp.y), k = q + ',' + r + ',' + y;
      if (seen.has(k) || (plow && y < minY)) continue;
      seen.add(k);
      const id = world.getBlock(q, r, y);
      if (id === AIR || isWater(id) || BLOCKS[id]?.lava || BLOCKS[id]?.unbreakable) continue;
      if (soft(id)) {
        world.setBlock(q, r, y, AIR);
        if (!fast && fx++ < 30) for (let i = 0; i < 2; i++) fireP.spawn(wp, vel.clone().multiplyScalar(0.3).add(rand3(8)), 0.7, BLOCKS[id].log ? '#6b5132' : '#3c8a2e', 3);
      } else if (plow || SUPPORT[id]) {
        if (!plow) return -1; // (en vol : un bloc dur, c'est le contact)
        world.setBlock(q, r, y, AIR);
        hard++;
        if (!fast && fx++ < 40) smokeP.spawn(wp, rand3(10).add(new THREE.Vector3(0, rr(3, 9), 0)), rr(1.2, 2.6), pick(['#6b4a2b', '#7d5a36', '#5a5a5a']), rr(3, 5), 4, 2);
      }
    }
    return hard;
  };

  const contact = (fast) => {
    phase = 'slide';
    contactAt = t;
    shake = 2;
    if (!fast) {
      flash.style.opacity = 0.5;
      try { playExplosion(18, true); } catch { /* (son indisponible) */ }
      for (let i = 0; i < 160; i++) smokeP.spawn(P.clone().add(rand3(16)), rand3(30).add(new THREE.Vector3(0, 10, 0)), rr(1.5, 3.5), pick(['#6b4a2b', '#7d5a36', '#5a5a5a']), rr(4, 7), 5, 1.8, 1);
    }
    tear(Math.floor(rr(14, 24)));
    vel.x *= 0.75; vel.z *= 0.75; // (le choc absorbe une partie de l'élan)
  };

  // ---------- Simulation ----------
  const step = (dt, fast = false) => {
    t += dt;
    if (phase === 'fly') {
      vel.y -= G * dt;
      P.addScaledVector(vel, dt);
      pitch = Math.atan2(-vel.y, Math.hypot(vel.x, vel.z)) * 0.8;
      roll = Math.sin(t * 1.7) * 0.12 + Math.sin(t * 4.1) * 0.03;
      slew = Math.sin(t * 0.8) * 0.05;
      orient();
      const g = surfaceAt(P.x, P.z, P.y + 2);
      const gn = surfaceAt(P.x + dir.x * 18, P.z + dir.z * 18, P.y + 4);
      if (P.y - 1 <= g + 1 || P.y - 1 - Math.sin(pitch) * 18 <= gn + 1) contact(fast);
      else if (((sweepTick++) & 1) === 0 && sweep(false, fast) < 0) contact(fast);
      if (!fast) {
        // en flammes : boule de feu à l'avant, longue traînée de fumée
        const k = 1 - smooth(FLIGHT * 0.5, FLIGHT * 0.95, t);
        wp.copy(P).addScaledVector(dir, 20);
        for (let i = 0; i < 8 * k + 2; i++) fireP.spawn(wp.clone().add(rand3(8)), vel.clone().multiplyScalar(-0.15).add(rand3(6)), 0.6, pick(['#ffb040', '#ff6020', '#fff0a0']), rr(9, 16) * (0.4 + k * 0.6), 6);
        for (let i = 0; i < 4; i++) smokeP.spawn(P.clone().add(rand3(8)), rand3(2), rr(5, 8), pick(['#2a2a2a', '#3a3a3a', '#4a4a4a']), rr(9, 14), 8);
      }
    } else if (phase === 'slide') {
      // vitesse le long du sol : frottement, plus ce qu'il pousse de terre ; l'eau freine moins
      let sp = Math.hypot(vel.x, vel.z);
      const hard = (sweepTick++ & 1) === 0 ? sweep(true, fast, Math.round(P.y)) : 0;
      const decel = (inWater ? 10 : 18) + Math.min(60, hard * 0.9);
      sp = Math.max(0, sp - decel * dt * (hard ? 2 : 1));
      vel.x = dir.x * sp; vel.z = dir.z * sp;
      // hauteur : il suit le sol (le plancher au niveau du sol, le ventre enfoncé d'un bloc) ;
      // un rebond au premier contact, il tombe dans les creux
      vel.y -= 28 * dt;
      P.addScaledVector(vel, dt);
      const g = surfaceAt(P.x, P.z, P.y - 0.5) + 1; // (le plancher juste au-dessus du sol : le ventre y est enfoncé)
      inWater = wet(P.x, P.z);
      if (P.y <= g) {
        P.y = g;
        if (!bounced && vel.y < -4) { vel.y = 7; bounced = true; } else vel.y = 0;
      }
      pitch *= Math.exp(-dt * 2.5);
      roll = roll * Math.exp(-dt * 2) + Math.sin(t * 9) * 0.03 * Math.min(1, sp / 15);
      slew += (slewDir * 0.12 * Math.min(1, sp / 25) - slew) * dt * 1.5;
      if (sp < 8) slew *= Math.exp(-dt * 2); // (il revient droit en s'arrêtant : l'épave se pose sur la grille)
      orient();
      if (!fast) {
        if (sp > 2) {
          for (let i = 0; i < 4; i++) smokeP.spawn(P.clone().addScaledVector(dir, rr(-16, 16)).add(new THREE.Vector3(0, -1, 0)).addScaledVector(right, rr(-6, 6)), rand3(6).add(new THREE.Vector3(0, rr(3, 7), 0)), rr(1.5, 3), pick(inWater ? ['#e8f2ff', '#cfe0f0'] : ['#6b4a2b', '#7d5a36', '#8a7a6a']), rr(3, 6), 4, 1.5);
          for (let i = 0; i < 3; i++) fireP.spawn(P.clone().addScaledVector(dir, rr(-14, 14)).addScaledVector(right, rr(-4, 4)).add(new THREE.Vector3(0, -1, 0)), rand3(14).add(new THREE.Vector3(0, 5, 0)), 0.35, pick(['#ffd060', '#ffffff']), 1.4);
          shake = Math.max(shake, Math.min(1.2, sp / 18) + (hard ? 0.4 : 0));
          rumble -= dt;
          if (rumble <= 0) { rumble = rr(0.6, 1.1); try { playThunder(12 + 30 * (1 - Math.min(1, sp / 30))); } catch { /* */ } }
        }
        if (hard > 12 && Math.random() < 0.3) tear(2); // (une bosse : il perd encore des morceaux)
      }
      if ((sp < 0.4 && Math.abs(vel.y) < 0.5) || t - contactAt > 14) { phase = 'settle'; restAt = t; }
    } else if (phase === 'settle') {
      // il se pose : centré sur sa case, plancher sur un bloc entier (comme l'épave en blocs)
      const { q, r } = worldToHex(P.x, P.z), c = hexToWorld(q, r);
      const k = Math.min(1, dt * 4);
      P.x += (c.x - P.x) * k; P.z += (c.z - P.z) * k; P.y += (Math.round(P.y) - P.y) * k;
      pitch *= 1 - k; roll *= 1 - k; slew *= 1 - k;
      orient();
      if (t - restAt > 0.7) rest(q, r, Math.round(P.y));
    }
    // les blocs arrachés tombent et s'arrêtent au sol
    for (const d of debris) {
      if (d.still) continue;
      d.v.y -= 25 * dt;
      d.v.x *= Math.exp(-dt * 0.8); d.v.z *= Math.exp(-dt * 0.8);
      d.m.position.addScaledVector(d.v, dt);
      d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt; d.m.rotation.z += d.w.z * dt;
      const g = surfaceAt(d.m.position.x, d.m.position.z, d.m.position.y + 1) + 1;
      if (d.m.position.y <= g) {
        d.m.position.y = g;
        if (Math.abs(d.v.y) > 5) { d.v.y *= -0.3; d.v.x *= 0.5; d.v.z *= 0.5; d.w.multiplyScalar(0.5); }
        else { d.still = true; d.m.rotation.set(0, 0, 0); }
      }
    }
  };

  // ---------- L'arrêt : l'épave devient de vrais blocs ----------
  let rested = false;
  const rest = (q, r, y) => {
    phase = 'rest';
    rested = true;
    restAt = t;
    ship.visible = false;
    const fallen = [];
    for (const d of debris) {
      const p = d.m.position, h = worldToHex(p.x, p.z), gy = surfaceAt(p.x, p.z, p.y + 1) + 1;
      if (world.getBlock(h.q, h.r, gy) === AIR && !isWater(world.getBlock(h.q, h.r, gy - 1))) fallen.push([h.q, h.r, gy, d.b.id === 67 ? 66 : d.b.id]);
      scene.remove(d.m);
    }
    for (let i = 0; i < 50; i++) smokeP.spawn(P.clone().add(rand3(30)), rand3(10).add(new THREE.Vector3(0, 4, 0)), rr(1.5, 3), pick(['#6b4a2b', '#8a7a6a', '#5a5a5a']), rr(3, 5), 3, 1.5, 0.5);
    onRest({ q, r, y, rot, debris: fallen });
  };

  // ---------- Caméra ----------
  // un témoin au sol, sur le côté, qui le voit arriver du ciel ; puis derrière lui pendant la
  // glissade ; puis on tourne lentement autour de l'épave qui fume
  const sideW = Math.random() < 0.5 ? -1 : 1;
  const W = T.clone().addScaledVector(right, sideW * rr(40, 55)).addScaledVector(dir, rr(10, 35));
  W.y = Math.max(groundAt(W.x, W.z) + 3, topAt(W.x, W.z) + 1.5);
  const cam = new THREE.Vector3().copy(W), look = new THREE.Vector3().copy(P), lookS = new THREE.Vector3().copy(P);
  let fov = 62, orbitA = Math.atan2(-dir.z, -dir.x) + sideW * 1.2;
  const camUpdate = (dt) => {
    let shot = 'witness';
    if (phase !== 'fly' && t - contactAt > 1.6) shot = rested ? 'orbit' : 'chase';
    if (shot === 'witness') { cam.copy(W); look.copy(P); fov = 62 - smooth(0, FLIGHT, t) * 12; }
    else if (shot === 'chase') {
      cam.copy(P).addScaledVector(dir, -48).addScaledVector(right, sideW * 12);
      cam.y = Math.max(P.y + 12, groundAt(cam.x, cam.z) + 4, topAt(cam.x, cam.z) + 2);
      look.copy(P).addScaledVector(dir, 10); fov = 60;
    } else {
      orbitA += dt * 0.12 * sideW;
      cam.set(P.x + Math.cos(orbitA) * 58, 0, P.z + Math.sin(orbitA) * 58);
      cam.y = Math.max(P.y + 16, topAt(cam.x, cam.z) + 3);
      look.copy(P).add(new THREE.Vector3(0, 2, 0)); fov = 55;
    }
    lookS.lerp(look, 1 - Math.exp(-dt * (shot === 'witness' ? 7 : 4)));
    shake = Math.max(0, shake - dt * 1.3);
  };

  // ---------- Fin, passer ----------
  const FADE = 4.5; // (secondes après l'arrêt avant le noir)
  let finished = false, camRef = null, baseFov = 0;
  const cleanup = () => {
    scene.remove(ship, fireP.points, smokeP.points);
    for (const d of debris) scene.remove(d.m);
    geo.dispose();
    fireP.geo.dispose(); smokeP.geo.dispose(); fireP.points.material.dispose(); smokeP.points.material.dispose();
    for (const ms of matCache.values()) ms.forEach((m) => m.dispose());
    for (const tx of texCache.values()) tx?.dispose();
    release();
    root.remove();
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    cleanup();
    api.active = false;
    if (camRef) { camRef.fov = baseFov; camRef.updateProjectionMatrix(); }
    wakeScreen(onEnd);
  };
  const skip = () => {
    // on va au bout tout de suite (la simulation tourne sans rien dessiner)
    for (let i = 0; i < 2400 && !rested; i++) step(1 / 30, true);
    finish();
  };
  const release = grabKeys(skip);
  root.addEventListener('pointerdown', skip);
  try { playThunder(60); } catch { /* (son indisponible) */ }

  const api = {
    active: true,
    update(dt) {
      if (finished) return;
      step(dt);
      camUpdate(dt);
      fireP.update(dt);
      smokeP.update(dt);
      if (rested) {
        // l'épave fume
        if (Math.random() < 0.6) smokeP.spawn(P.clone().add(rand3(14)).add(new THREE.Vector3(0, 6, 0)), new THREE.Vector3(rr(-0.5, 0.5), rr(3, 5), rr(-0.5, 0.5)), rr(4, 6), pick(['#2a2a2a', '#3a3a3a', '#555555']), rr(2, 4), 4, 0.3, 0.3);
      }
      black.style.opacity = Math.max(1 - smooth(0, 1.2, t), rested ? smooth(FADE - 1.2, FADE, t - restAt) : 0);
      flash.style.opacity = Math.max(0, Number(flash.style.opacity || 0) - dt * 2);
      if (rested && t - restAt > FADE) finish();
    },
    apply(camera) {
      if (finished) return;
      if (!camRef) { camRef = camera; baseFov = camera.fov; }
      camera.position.copy(cam);
      if (shake > 0) camera.position.add(rand3(shake * 0.9));
      camera.lookAt(lookS);
      if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    },
    skip,
  };
  return api;
}

// ---------- Le micro-vaisseau (les joueurs qui rejoignent une partie) ----------
// Une capsule de secours d'une trentaine de blocs (plancher en acier assombri, parois en acier,
// verrière à l'avant et hublot sur le toit, le gravitron, un réacteur à l'arrière, deux
// ailerons et un nez en vieil acier). Le joueur qui rejoint une partie pour la première fois
// s'écrase avec elle dans l'eau, près du point d'apparition ; les autres joueurs la voient
// arriver du ciel en flammes, ricocher sur l'eau et s'arrêter. L'hôte la pose ensuite en vrais
// blocs : elle flotte (son plancher au niveau de l'eau), et on se réveille debout sur son toit.
// Tout est décidé à l'avance (planPod) et envoyé aux autres : chacun joue exactement la même
// trajectoire, sans physique (playPod). (La capsule elle-même : podBlocks, dans intro.js.)

// Où et comment elle s'écrase : dans l'eau la plus proche du point d'apparition (center), en
// ricochant dans une des six directions. Renvoie un plan (que des nombres : il part en ligne).
export function planPod(world, center) {
  const soft = (id) => { const b = BLOCKS[id]; return !!(b && (b.leaves || b.log || b.sapling || b.torch || id === 196)); };
  const surf = (x, z) => {
    const { q, r } = worldToHex(x, z);
    for (let y = H - 2; y > Y_MIN; y--) { const id = world.getBlock(q, r, y); if (id !== AIR && !soft(id)) return { y, wet: !!BLOCKS[id]?.liquid }; }
    return { y: 0, wet: false };
  };
  const wetAt = (x, z) => surf(x, z).wet;
  let T = null;
  for (let rad = 10; rad <= 130 && !T; rad += 6) {
    const a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < 24 && !T; i++) {
      const a = a0 + (i / 24) * Math.PI * 2, x = center.x + Math.cos(a) * rad, z = center.z + Math.sin(a) * rad;
      if (wetAt(x, z) && [[5, 0], [-5, 0], [0, 5], [0, -5]].every(([dx, dz]) => wetAt(x + dx, z + dz))) T = { x, z };
    }
  }
  const wet = !!T;
  if (!T) { const a = Math.random() * Math.PI * 2; T = { x: center.x + Math.cos(a) * 14, z: center.z + Math.sin(a) * 14 }; }
  const rot = Math.floor(Math.random() * 6);
  const [nq, nr] = rotHex(1, -2, rot), nw = hexToWorld(nq, nr), dl = Math.hypot(nw.x, nw.z);
  const dx = nw.x / dl, dz = nw.z / dl;
  let L = wet ? 16 : 5;
  while (wet && L > 2 && !wetAt(T.x + dx * L, T.z + dz * L)) L -= 2;
  const s = surf(T.x, T.z), ty = wet ? s.y : s.y + 1;
  return { sx: T.x - dx * 230, sy: ty + rr(95, 125), sz: T.z - dz * 230, tx: T.x, ty, tz: T.z, dx, dz, L, F: rr(3.8, 4.6), rot, wet: wet ? 1 : 0 };
}

// Joue la chute de la capsule. own : c'est la nôtre (la caméra la suit, écran noir et réveil à la
// fin, onEnd(où se réveiller) au clic) ; sinon on la voit seulement passer. ear() : où est
// l'oreille du joueur (le bruit de l'impact). onRest(blocs [[q, r, y, id]]) : elle s'est
// arrêtée (l'hôte la pose en blocs).
export function playPod({ scene, atlas, plan, own = false, ear = null, onRest = () => {}, onEnd = () => {} }) {
  const S = new THREE.Vector3(plan.sx, plan.sy, plan.sz), T = new THREE.Vector3(plan.tx, plan.ty, plan.tz);
  const dir = new THREE.Vector3(plan.dx, 0, plan.dz).normalize(), right = new THREE.Vector3().crossVectors(dir, UP).normalize();
  const F = plan.F, SKID = 2.2, wet = !!plan.wet;
  const R = T.clone().addScaledVector(dir, plan.L);
  const cell = worldToHex(R.x, R.z), cw = hexToWorld(cell.q, cell.r);
  // la capsule, en blocs (tournée d'un sixième de tour)
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
      const b = BLOCKS[id], M = id === 67 ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
      const o = id === 40 ? { transparent: true, opacity: 0.5, depthWrite: false } : {};
      const m = (n) => { const t = tex(n); return t ? new M({ map: t, ...o }) : new M({ color: 0x8a8a8a, ...o }); };
      mats.set(id, [m(b.side), m(b.top + '_cap'), m(b.bottom + '_cap')]);
    }
    return mats.get(id);
  };
  const geo = hexPrism(1 / Math.sqrt(3), 1);
  const pod = new THREE.Group();
  const list = podBlocks().map(([q, r, y, id]) => { const [a, b] = rotHex(q, r, plan.rot); return [a, b, y, id]; });
  for (const [q, r, y, id] of list) {
    const w = hexToWorld(q, r), m = new THREE.Mesh(geo, matsOf(id));
    m.position.set(w.x, y, w.z);
    pod.add(m);
  }
  scene.add(pod);
  const fireP = new Particles(scene, 900, true), smokeP = new Particles(scene, 900, false);

  // ---------- (la nôtre) bandes noires, voile, passer ----------
  let root = null, black = null, release = () => {};
  if (own) {
    injectStyle();
    root = document.createElement('div');
    root.id = 'crash';
    root.innerHTML = `<div class="veil bars" style="opacity:1"></div><div class="veil black" style="opacity:1"></div><div class="skip">Clic, Échap ou Espace : passer</div>`;
    document.body.appendChild(root);
    black = root.querySelector('.black');
  }

  let t = 0, landed = false, rested = false, finished = false;
  const P = new THREE.Vector3().copy(S);
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  const placeAt = (pitch, roll) => {
    q1.setFromAxisAngle(right, -pitch);
    q2.setFromAxisAngle(dir, roll);
    pod.quaternion.copy(q1).multiply(q2);
    pod.position.copy(P);
  };
  const rest = () => {
    if (rested) return;
    rested = true;
    pod.visible = false;
    onRest(list.map(([q, r, y, id]) => [cell.q + q, cell.r + r, Math.round(T.y) + y, id === 67 ? 66 : id]));
  };
  const step = (dt) => {
    t += dt;
    if (t < F) {
      P.lerpVectors(S, T, t / F);
      placeAt(Math.atan2(S.y - T.y, S.distanceTo(T)) * 0.9, Math.sin(t * 6) * 0.25);
      for (let i = 0; i < 5; i++) fireP.spawn(P.clone().addScaledVector(dir, 2).add(rand3(2.5)), rand3(4), 0.5, pick(['#ffb040', '#ff6020', '#fff0a0']), rr(3, 6), 4);
      smokeP.spawn(P.clone().add(rand3(3)), rand3(1.5), rr(3, 5), pick(['#2a2a2a', '#444444']), rr(4, 7), 6);
    } else if (t < F + SKID) {
      if (!landed) {
        landed = true;
        const d = ear ? ear().distanceTo(T) : 20;
        try { playExplosion(Math.max(6, d), false); } catch { /* (son indisponible) */ }
        // la gerbe d'eau (ou de terre)
        for (let i = 0; i < 160; i++) smokeP.spawn(T.clone().add(rand3(4)), rand3(14).add(new THREE.Vector3(0, rr(8, 22), 0)), rr(1, 2.2), wet ? pick(['#ffffff', '#dbe9f5', '#b8d4ec']) : pick(['#6b4a2b', '#7d5a36']), rr(2, 4), 2, 0.5, -14);
      }
      const s = (t - F) / SKID, k = 1 - (1 - s) ** 2;
      P.copy(T).addScaledVector(dir, plan.L * k);
      // les derniers instants : elle se cale sur sa case
      const c = smooth(0.75, 1, s);
      P.x += (cw.x - P.x) * c; P.z += (cw.z - P.z) * c;
      P.y = T.y + Math.abs(Math.sin(s * Math.PI * 3)) * 1.6 * (1 - s);
      placeAt(0.15 * (1 - s), Math.sin(s * 14) * 0.15 * (1 - s));
      if (s < 0.8) for (let i = 0; i < 3; i++) smokeP.spawn(P.clone().add(rand3(2)), rand3(6).add(new THREE.Vector3(0, rr(3, 7), 0)), rr(0.8, 1.5), wet ? '#e8f2ff' : '#7d5a36', rr(1.5, 3), 2, 0.5, -10);
    } else {
      P.set(cw.x, T.y, cw.z);
      placeAt(0, 0);
      rest();
      if (Math.random() < 0.5) smokeP.spawn(P.clone().add(new THREE.Vector3(0, 3, 0)).add(rand3(2)), new THREE.Vector3(rr(-0.3, 0.3), rr(2, 3.5), rr(-0.3, 0.3)), rr(3, 5), pick(['#2a2a2a', '#444444']), rr(2, 3), 3);
    }
  };

  // caméra (la nôtre) : depuis la rive, puis on tourne autour de la capsule qui fume
  const sideW = Math.random() < 0.5 ? -1 : 1;
  const W = T.clone().addScaledVector(right, sideW * 26).addScaledVector(dir, -8); W.y = T.y + 4;
  const cam = W.clone(), look = S.clone(), lookS = S.clone();
  let orbitA = Math.atan2(W.z - R.z, W.x - R.x), camRef = null, baseFov = 0;
  const END = F + SKID + 3.5;
  const cleanup = () => {
    scene.remove(pod, fireP.points, smokeP.points);
    geo.dispose();
    fireP.geo.dispose(); smokeP.geo.dispose(); fireP.points.material.dispose(); smokeP.points.material.dispose();
    for (const ms of mats.values()) ms.forEach((m) => m.dispose());
    for (const tx of texCache.values()) tx?.dispose();
    release();
    root?.remove();
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    rest();
    cleanup();
    api.active = false;
    if (camRef) { camRef.fov = baseFov; camRef.updateProjectionMatrix(); }
    if (own) wakeScreen(() => onEnd({ x: cw.x, y: Math.round(T.y) + 3, z: cw.z }));
  };
  if (own) {
    release = grabKeys(finish);
    root.addEventListener('pointerdown', finish);
  }

  const api = {
    active: true,
    update(dt) {
      if (finished) return;
      step(dt);
      fireP.update(dt);
      smokeP.update(dt);
      if (own) {
        if (!rested) { cam.copy(W); look.copy(P); } else {
          orbitA += dt * 0.2 * sideW;
          cam.set(R.x + Math.cos(orbitA) * 18, T.y + 7, R.z + Math.sin(orbitA) * 18);
          look.set(cw.x, T.y + 1.5, cw.z);
        }
        lookS.lerp(look, 1 - Math.exp(-dt * 6));
        black.style.opacity = Math.max(1 - smooth(0, 1, t), smooth(END - 1.2, END, t));
      }
      if (t > END) finish();
    },
    apply(camera) {
      if (!own || finished) return;
      if (!camRef) { camRef = camera; baseFov = camera.fov; }
      camera.position.copy(cam);
      if (landed && t < F + 0.6) camera.position.add(rand3(0.5));
      camera.lookAt(lookS);
    },
    skip: finish,
  };
  return api;
}
