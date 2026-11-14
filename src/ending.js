// La fin du jeu : la balise interstellaire, branchée sur l'antenne du Traveler-98, envoie enfin
// le message de l'équipage vers la Terre (voir onBeacon dans main.js).
//  1. dans le monde : la caméra tourne autour de la balise, un faisceau bleu monte vers le ciel,
//     puis on le suit vers le haut ;
//  2. le noir : le message part, à travers les étoiles (un point bleu qui file), et s'écrit ;
//  3. le titre, puis les crédits (l'équipage du Traveler-98, puis ceux de l'écran Crédits) ;
//  4. « Le monde continue » : un clic, et la partie reprend.
// Même principe que departure.js : le jeu appelle update(dt) puis apply(camera) à chaque image.
import * as THREE from 'three';
import { injectStyle, grabKeys } from './crash.js?v=1.1.5-alpha-mwgq2wrb';
import { makeBeam } from './starfx.js?v=1.1.5-alpha-mwgq2wrb';

const smooth = (a, b, t) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

// Moments (secondes)
const BEAM = 1.6, UP = 6.8, DARK = 9.2, TITLE = 30.6, ROLL = 35, ROLL_LEN = 26, END = ROLL + ROLL_LEN;
const CAPS = [
  [0.4, 3.4, 'ORA : Antenne du Traveler-98… alignée.'],
  [3.7, 7.6, 'ORA : Balise chargée. Transmission vers la Terre.'],
  [10.4, 14, 'TRANSMISSION — antenne du TRAVELER-98, planète Hexa. An 3047.', 'msg'],
  [14.3, 18, 'Destinataire : Terre. Archives de la mission TRAVELER-98.', 'msg'],
  [18.3, 22.4, "L'équipage du Destiny-InterSpace a atteint Hexa en 2806. Ils n'ont jamais pu en repartir.", 'msg'],
  [22.7, 26.2, 'Leurs rapports sont joints. Leur mission est accomplie.', 'msg'],
  [26.5, 30.4, 'Nous avons trouvé un second foyer.', 'big'],
];

function style() {
  if (document.getElementById('ending-style')) return;
  const st = document.createElement('style');
  st.id = 'ending-style';
  st.textContent = `
  #ending canvas.stars { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; pointer-events: none; }
  #ending .caption.msg { font-style: normal; font-family: Consolas, 'Courier New', monospace; color: #9ad8ff; letter-spacing: 0.02em; }
  #ending .caption.big { font-style: normal; color: #ffffff; font-size: clamp(22px, 3.4vw, 40px); font-weight: 600; bottom: 44%; }
  #ending .title { opacity: 0; }
  #ending .title p { letter-spacing: 0.06em; }
  #ending .roll { position: absolute; left: 50%; top: 0; width: min(560px, calc(100% - 32px)); transform: translate(-50%, 100vh);
    text-align: center; color: #c8d2dc; font-family: 'Segoe UI', system-ui, sans-serif; opacity: 0; pointer-events: none; }
  #ending .roll h2 { font-size: clamp(30px, 5vw, 54px); letter-spacing: 0.3em; color: #fff; margin: 0 0 40px; }
  #ending .roll h3 { color: #5ac8ff; font-size: 15px; letter-spacing: 0.14em; text-transform: uppercase; margin: 34px 0 8px; }
  #ending .roll p { margin: 4px 0; font-size: 18px; line-height: 1.5; }
  #ending .roll .logo-text { font-size: 44px; margin-bottom: 6px; }
  #ending .roll .version, #ending .roll .thanks { display: none; }
  #ending .roll .last { margin-top: 60px; font-size: 22px; color: #fff; font-style: italic; }
  #ending .again { position: absolute; left: 50%; bottom: 12%; transform: translateX(-50%); color: #e8eef4; font-size: clamp(16px, 2vw, 22px);
    opacity: 0; text-align: center; text-shadow: 0 2px 10px #000; }
  #ending .again small { display: block; margin-top: 8px; color: #8a96a4; font-size: 0.75em; }`;
  document.head.appendChild(st);
}

// scene : la scène du monde ; at : la balise (x, y, z : le centre de son bloc) ; onEnd() : fin (ou passée)
export function playEnding({ scene, at, onEnd = () => {} }) {
  injectStyle();
  style();
  // ---------- dans le monde : le faisceau de la balise ----------
  const P = new THREE.Vector3(at.x, at.y, at.z);
  const beam = makeBeam({ length: 1400, r0: 0.9, r1: 12, color: 0x3a9cff, core: 0xeaf6ff, opacity: 0, fall: 1, sharp: 3, dust: 0.3, gain: 2, base: -0.005 });
  const halo = makeBeam({ length: 600, r0: 3, r1: 36, color: 0x2a6cff, core: 0x9ad8ff, opacity: 0, fall: 1, sharp: 2, dust: 0.2, gain: 1.5, base: 0 });
  for (const b of [beam, halo]) { b.position.copy(P); b.position.y += 0.5; b.renderOrder = 5; scene.add(b); }
  const light = new THREE.PointLight(0x5ac8ff, 0, 30, 1.6);
  light.position.copy(P).add(new THREE.Vector3(0, 1.5, 0));
  scene.add(light);

  // ---------- écran ----------
  const root = document.createElement('div');
  root.id = 'crash';
  const credits = document.querySelector('#scr-credits .credits')?.innerHTML || '';
  root.innerHTML = `<div id="ending" style="position:absolute;inset:0">
    <div class="veil bars" style="opacity:1"></div><div class="veil black"></div><canvas class="stars"></canvas><div class="veil flash"></div>
    <div class="caption"></div>
    <div class="title"><h1>Hexa<span>Craft</span></h1><p>Pour l'avenir de l'humanité.</p></div>
    <div class="roll"><h2>FIN</h2>
      <h3>L'équipage du TRAVELER-98</h3>
      <p>Bryan Space — scientifique et ingénieur</p><p>Ethan Bismarck — militaire, scientifique et mécanicien</p>
      <p>Zarvin Haizen — explorateur et archéologue</p><p>Souaï Orion — exploratrice et médecin</p><p>Akhena Pink — communications et rapports</p>
      <h3>Cheffe de mission</h3><p>Leila Space</p>
      <div style="margin-top:50px">${credits}</div>
      <p class="last">Merci d'avoir joué à HexaCraft.</p></div>
    <div class="again">Le monde continue. Ta partie t'attend.<small>Clic, Échap ou Espace : reprendre</small></div>
    <div class="skip">Clic, Échap ou Espace : passer</div></div>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const caption = $('.caption'), black = $('.black'), flash = $('.flash'), title = $('.title'), roll = $('.roll'), again = $('.again'), skip = $('.skip');
  const cv = $('canvas.stars'), cx = cv.getContext('2d');
  // (les étoiles qui défilent : le message file à travers l'espace)
  const stars = Array.from({ length: 420 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
  const drawStars = (t, dt) => {
    const W = (cv.width = cv.clientWidth), H = (cv.height = cv.clientHeight);
    cx.fillStyle = '#000';
    cx.fillRect(0, 0, W, H);
    const v = 0.08 + smooth(DARK, DARK + 5, t) * 0.5 - smooth(26, 30, t) * 0.45;
    for (const s of stars) {
      const z0 = s.z;
      s.z -= dt * v;
      if (s.z <= 0.02) { s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; s.z = 1; continue; }
      const k = Math.min(W, H) * 0.5, ax = W / 2 + (s.x / s.z) * k, ay = H / 2 + (s.y / s.z) * k, bx = W / 2 + (s.x / z0) * k, by = H / 2 + (s.y / z0) * k;
      const a = Math.min(1, (1 - s.z) * 1.4);
      cx.strokeStyle = `rgba(210,228,255,${a})`;
      cx.lineWidth = Math.max(0.6, (1 - s.z) * 2.2);
      cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(ax, ay); cx.stroke();
    }
    // le signal : un point bleu qui pulse, au centre (on le suit)
    const p = 0.75 + 0.25 * Math.sin(t * 9);
    const g = cx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 40 * p);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(120,200,255,0.9)'); g.addColorStop(1, 'rgba(40,120,255,0)');
    cx.fillStyle = g;
    cx.beginPath(); cx.arc(W / 2, H / 2, 40 * p, 0, Math.PI * 2); cx.fill();
  };

  // ---------- caméra ----------
  const cam = new THREE.Vector3(), look = new THREE.Vector3();
  const shot = (t) => {
    const a = 0.6 + t * 0.22, up = smooth(UP, DARK, t);
    cam.set(P.x + Math.cos(a) * (13 - up * 4), P.y + 4 + up * 3, P.z + Math.sin(a) * (13 - up * 4));
    look.set(P.x, P.y + 1 + up * up * 90, P.z);
  };

  let t = 0, finished = false, waiting = false;
  const cleanup = () => {
    for (const b of [beam, halo]) { scene.remove(b); b.geometry.dispose(); b.material.dispose(); }
    scene.remove(light);
    release();
    root.remove();
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    cleanup();
    api.active = false;
    onEnd();
  };
  // (passer : d'abord jusqu'au dernier écran, puis reprendre la partie)
  const next = () => { if (waiting) finish(); else if (t > 0.5) { t = Math.max(t, END); } };
  const release = grabKeys(next);
  root.addEventListener('pointerdown', next);

  const api = {
    active: true,
    get t() { return t; },
    update(dt) {
      if (finished) return;
      t += dt;
      // le faisceau : il s'allume, grandit, pulse
      const on = smooth(BEAM, BEAM + 1.4, t) * (1 - smooth(DARK, DARK + 0.5, t));
      beam.material.opacity = on * (1.1 + 0.25 * Math.sin(t * 7));
      halo.material.opacity = on * 0.5;
      beam.userData.tick(dt); halo.userData.tick(dt);
      light.intensity = on * 6;
      shot(t);
      // les écrans
      const cap = CAPS.find(([a, b]) => t >= a && t < b);
      caption.textContent = cap ? cap[2].slice(0, Math.floor((t - cap[0]) * (cap[3] ? 34 : 40))) : '';
      caption.className = 'caption' + (cap?.[3] ? ' ' + cap[3] : '');
      caption.style.opacity = cap ? 1 - smooth(cap[1] - 0.4, cap[1], t) : 0;
      flash.style.opacity = smooth(BEAM - 0.1, BEAM + 0.1, t) * (1 - smooth(BEAM + 0.2, BEAM + 1, t)) * 0.6;
      black.style.opacity = Math.max(1 - smooth(0, 0.8, t), smooth(DARK - 0.6, DARK, t));
      const starsOn = smooth(DARK, DARK + 1, t) * (1 - smooth(TITLE - 0.8, TITLE, t));
      cv.style.opacity = starsOn;
      if (starsOn > 0) drawStars(t, dt);
      title.style.opacity = smooth(TITLE, TITLE + 1, t) * (1 - smooth(ROLL - 0.8, ROLL, t));
      const r = smooth(ROLL, ROLL + 0.5, t) * (1 - smooth(END - 1, END, t));
      roll.style.opacity = r;
      if (r > 0) roll.style.transform = `translate(-50%, ${innerHeight * (1 - (t - ROLL) / ROLL_LEN) - roll.offsetHeight * ((t - ROLL) / ROLL_LEN)}px)`;
      if (t >= END) { waiting = true; again.style.opacity = smooth(END, END + 1, t); skip.style.display = 'none'; }
    },
    apply(camera) {
      if (finished) return;
      camera.position.copy(cam);
      camera.lookAt(look);
    },
    skip: finish,
  };
  return api;
}
