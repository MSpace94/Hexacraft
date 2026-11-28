// La tablette : un objet qu'on tient (main droite, ou main secondaire : touche F) pour regarder YouTube
// et Twitch dans le jeu. Un vrai modèle 3D, la page posée sur son écran. Tenue, elle reste en bas de la vue
// (on voit la vidéo, on joue, on pilote) ; U ou clic droit : on la prend en main pour cliquer et
// taper dessus, le jeu continue (rien ne se met en pause).
//  - dans l'application (Electron) : le vrai site, dans une <webview> à part (partition
//    « persist:tablette » : on s'y connecte à son compte une fois, la connexion reste) ; on y
//    regarde des vidéos et des lives, on commente, on écrit dans le chat des lives. Le processus
//    principal (app/main.cjs) n'y laisse ouvrir que YouTube, Twitch et la connexion Google, sans aucun
//    accès au jeu ni au disque ;
//  - dans le navigateur (version web) : pas de <webview> ; on colle le lien d'une vidéo ou d'un
//    live (YouTube ou Twitch), il se lit dans le lecteur intégré du site (sans connexion ni chat).
import * as THREE from 'three';

// Les deux sites : l'accueil, les lives en cours, ses abonnements (connecté), la recherche
const SITES = {
  // (les lives de YouTube : le filtre « En direct » de sa recherche)
  youtube: { name: 'YouTube', home: 'https://www.youtube.com/', lives: 'https://www.youtube.com/results?search_query=live&sp=EgJAAQ%253D%253D', subs: 'https://www.youtube.com/feed/subscriptions', search: (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) },
  twitch: { name: 'Twitch', home: 'https://www.twitch.tv/', lives: 'https://www.twitch.tv/directory/all', subs: 'https://www.twitch.tv/directory/following', search: (q) => 'https://www.twitch.tv/search?term=' + encodeURIComponent(q) },
};
const HOME = SITES.youtube.home;
// (le site d'une adresse)
export const siteOf = (url) => { try { return /(^|\.)twitch\.tv$/.test(new URL(url).hostname) ? 'twitch' : 'youtube'; } catch { return 'youtube'; } };
// Une adresse Twitch : { channel } (une chaîne, son live) ou { video } (une rediffusion), ou null
export function twitchOf(text) {
  try {
    const t = String(text || '').trim(), u = new URL(t.startsWith('http') ? t : 'https://' + t);
    if (!/(^|\.)twitch\.tv$/.test(u.hostname)) return null;
    const v = /^\/videos\/(\d+)/.exec(u.pathname)?.[1];
    if (v) return { video: v };
    const c = /^\/([A-Za-z0-9_]{3,25})\/?$/.exec(u.pathname)?.[1];
    return c && !['directory', 'search', 'login', 'signup', 'settings', 'videos', 'downloads', 'p'].includes(c.toLowerCase()) ? { channel: c } : null;
  } catch { return null; }
}
const native = () => !!window.hexaNative;

// Une adresse YouTube (vidéo, live, chaîne...) ou un identifiant de vidéo : son identifiant de vidéo, ou null
export function videoId(text) {
  const t = String(text || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  try {
    const u = new URL(t.startsWith('http') ? t : 'https://' + t);
    const h = u.hostname.replace(/^(www|m|music)\./, '');
    if (h === 'youtu.be') return /^\/([A-Za-z0-9_-]{11})/.exec(u.pathname)?.[1] || null;
    if (h !== 'youtube.com' && h !== 'youtube-nocookie.com') return null;
    if (u.searchParams.get('v')) return /^[A-Za-z0-9_-]{11}$/.test(u.searchParams.get('v')) ? u.searchParams.get('v') : null;
    return /^\/(?:embed|live|shorts|v)\/([A-Za-z0-9_-]{11})/.exec(u.pathname)?.[1] || null;
  } catch { return null; }
}
// Ce qu'on tape dans la barre : une adresse YouTube ou Twitch (on y va), sinon une recherche sur le
// site affiché
export function addressOf(text, site = 'youtube') {
  const t = String(text || '').trim(), S = SITES[site] || SITES.youtube;
  if (!t) return S.home;
  try {
    const u = new URL(t.startsWith('http') ? t : 'https://' + t);
    if (/(^|\.)(youtube\.com|youtu\.be|twitch\.tv)$/.test(u.hostname) && (u.protocol === 'https:' || u.protocol === 'http:')) { u.protocol = 'https:'; return u.href; }
  } catch { /* une recherche */ }
  return S.search(t);
}

// ---------- Le modèle 3D ----------
// La tablette : 16 x 10 (l'écran), un cadre noir aux coins arrondis, la caméra en haut, un bouton
// sur la tranche. Son écran est la vraie page (un élément HTML posé dessus en perspective)
const TW = 0.52, TH = 0.34, TD = 0.018;   // la tablette (unités de la scène de la main)
const SW = 0.48, SH = 0.30;               // son écran
const BW = 1280, BH = 800;                // la page, en pixels CSS (16 x 10, comme l'écran)
const FRAME = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([x, y]) => new THREE.Vector3(x * TW / 2, y * TH / 2, 0));
function tabletModel() {
  const g = new THREE.Group();
  const r = 0.03, w = TW / 2, h = TH / 2;
  const sh = new THREE.Shape();
  sh.moveTo(-w + r, -h); sh.lineTo(w - r, -h); sh.quadraticCurveTo(w, -h, w, -h + r);
  sh.lineTo(w, h - r); sh.quadraticCurveTo(w, h, w - r, h); sh.lineTo(-w + r, h);
  sh.quadraticCurveTo(-w, h, -w, h - r); sh.lineTo(-w, -h + r); sh.quadraticCurveTo(-w, -h, -w + r, -h);
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(sh, { depth: TD, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 6 }),
    new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.45, metalness: 0.4 }));
  body.position.z = -TD;
  g.add(body);
  // (l'écran éteint, sous la page : noir brillant)
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ color: 0x050608 }));
  screen.position.z = 0.0045;
  g.add(screen);
  const cam = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 12), new THREE.MeshBasicMaterial({ color: 0x2a3a50 }));
  cam.position.set(0, SH / 2 + (TH - SH) / 4, 0.0046);
  g.add(cam);
  const btn = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.008), new THREE.MeshStandardMaterial({ color: 0x3a3e46, metalness: 0.6, roughness: 0.4 }));
  btn.position.set(TW / 2 - 0.09, TH / 2 + 0.004, -TD / 2);
  g.add(btn);
  g.userData.corners = [[-SW / 2, SH / 2], [SW / 2, SH / 2], [SW / 2, -SH / 2], [-SW / 2, -SH / 2]].map(([x, y]) => new THREE.Vector3(x, y, 0.0048));
  return g;
}
// La page de la tablette plafonnée à 60 images par seconde (le jeu en FPS illimités déverrouille aussi
// les pages : YouTube tournait alors à des centaines d'images par seconde et prenait la carte
// graphique au jeu). Ses animations (requestAnimationFrame) passent par paquets, une fois par 1/60 s ;
// la vidéo, elle, garde sa cadence.
const RAF_CAP = `(() => { if (window.__hexaRaf) return 0; window.__hexaRaf = 1;
  const raf = window.requestAnimationFrame.bind(window), caf = window.cancelAnimationFrame.bind(window);
  let q = new Map(), id = 1e9, pending = false, last = 0;
  const pump = (t) => { const w = 16.4 - (t - last); if (w > 1) { setTimeout(() => raf(pump), w - 1); return; }
    last = t; pending = false; const run = q; q = new Map();
    for (const f of run.values()) { try { f(t); } catch (e) { setTimeout(() => { throw e; }); } } };
  window.requestAnimationFrame = (f) => { const k = ++id; q.set(k, f); if (!pending) { pending = true; raf(pump); } return k; };
  window.cancelAnimationFrame = (k) => { if (!q.delete(k)) caf(k); };
  return 1; })()`;
// Transformation CSS qui pose un rectangle w x h sur le quadrilatère p (haut-gauche, haut-droit,
// bas-droit, bas-gauche, en pixels) : une homographie (carré unité -> quadrilatère), en matrix3d
function quadMatrix(w, h, p) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = p;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(det) < 1e-9 ? 0 : (dx3 * dy2 - dx2 * dy3) / det, hh = Math.abs(det) < 1e-9 ? 0 : (dx1 * dy3 - dx3 * dy1) / det;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, c = x0, d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3, f = y0;
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, c, f, 0, 1];
  return 'matrix3d(' + m.map((v) => +v.toFixed(8)).join(',') + ')';
}

export class Tablet {
  constructor() {
    this.root = null;
    this.site = 'youtube'; // (le site affiché : YouTube ou Twitch)
    this.view = null;   // la <webview> (application) ou l'<iframe> (web)
    this.built = false;
    this.onClose = null; // (✕ ou Échap dans la barre : on reprend la main dans le jeu)
    // la scène de la tablette (rendue par-dessus le monde, comme la main)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.light = new THREE.DirectionalLight(0xffffff, 1);
    this.light.position.set(-0.3, 1, 0.6);
    this.scene.add(this.hemi, this.light);
    this.model = tabletModel();
    this.scene.add(this.model);
    this.k = 0;          // 0 : tenue en main, 1 : regardée de près (lissé)
    this.side = -1;      // -1 : main gauche (secondaire), 1 : main droite
    this.shown = false;
    this.kept = false; // (encore en main, même cachée : la vidéo continue)
    this.focus = false;
    this.tmp = new THREE.Vector3();
    // (réglages, voir main.js) tilt : tenue penchée vers soi (plus joli, mais la page en perspective
    // coûte cher à afficher : 2 à 3 fois moins d'images par seconde avec une vidéo) ; capFps : la page
    // plafonnée à 60 images/s (le jeu en FPS illimités)
    this.tilt = false;
    this.capFps = false;
    this.rect = null;   // (la place du canevas du jeu : lue une fois, puis à chaque changement de taille)
    this.lastTr = '';
    addEventListener('resize', () => { this.rect = null; });
  }
  // (construite une fois : la page reste chargée tant que le jeu tourne)
  build() {
    const root = document.createElement('div');
    root.id = 'tablet-screen';
    root.className = 'tablet-ui';
    root.style.width = BW + 'px';
    root.style.height = BH + 'px';
    document.body.appendChild(root);
    this.root = root;
    root.innerHTML = `<div class="tab-bar">
        <button class="tab-btn" data-a="back" title="Retour">◀</button>
        <button class="tab-btn" data-a="fwd" title="Suivant">▶</button>
        <button class="tab-btn" data-a="reload" title="Recharger">⟳</button>
        <button class="tab-btn tab-site on" data-a="youtube" title="YouTube : son accueil">YouTube</button>
        <button class="tab-btn tab-site" data-a="twitch" title="Twitch : son accueil">Twitch</button>
        <button class="tab-btn" data-a="lives" title="Les lives en cours">Lives</button>
        <button class="tab-btn" data-a="subs" title="Tes abonnements, tes chaînes suivies (connecté)">Abonnements</button>
        <input class="tab-url" type="text" spellcheck="false" placeholder="${native() ? 'Rechercher sur YouTube, ou coller un lien' : 'Coller le lien d\'une vidéo ou d\'un live YouTube ou Twitch'}">
        <button class="tab-btn" data-a="go">OK</button>
        <button class="tab-btn tab-close" data-a="close" title="Reprendre la main dans le jeu (Échap)">✕</button>
      </div>
      <div class="tab-screen"></div>
      <div class="tab-foot"></div>`;
    const screen = root.querySelector('.tab-screen'), foot = root.querySelector('.tab-foot');
    this.foot = foot;
    this.url = root.querySelector('.tab-url');
    if (native()) {
      const v = document.createElement('webview');
      v.setAttribute('partition', 'persist:tablette');
      v.setAttribute('allowpopups', '');
      v.setAttribute('src', HOME);
      v.className = 'tab-view';
      // (l'adresse affichée suit la page)
      const sync = (e) => { if (document.activeElement !== this.url) this.url.value = e.url || ''; this.setSite(siteOf(e.url)); };
      v.addEventListener('did-navigate', sync);
      v.addEventListener('did-navigate-in-page', (e) => e.isMainFrame && sync(e));
      v.addEventListener('did-fail-load', (e) => { if (e.isMainFrame && e.errorCode !== -3) foot.textContent = 'Pas de connexion à ' + SITES[this.site].name + ' (' + (e.errorDescription || e.errorCode) + ')'; });
      v.addEventListener('did-finish-load', () => this.hint());
      v.addEventListener('dom-ready', () => { if (this.capFps) v.executeJavaScript(RAF_CAP).catch(() => {}); });
      screen.appendChild(v);
      this.view = v;
      foot.textContent = 'Chargement...';
    } else {
      const f = document.createElement('iframe');
      f.className = 'tab-view';
      f.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
      f.setAttribute('allowfullscreen', '');
      f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      screen.appendChild(f);
      this.view = f;
      for (const b of root.querySelectorAll('[data-a="back"], [data-a="fwd"], [data-a="subs"], [data-a="lives"], .tab-site')) b.hidden = true;
      foot.textContent = 'Version web : colle le lien d\'une vidéo ou d\'un live (YouTube, ou une chaîne Twitch). Dans l\'application HexaCraft, la tablette ouvre tout YouTube et Twitch (compte, abonnements, chat des lives).';
      this.blank();
    }
    root.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => this.act(b.dataset.a)));
    this.url.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); this.act('go'); }
      else if (e.code === 'Escape') { e.preventDefault(); this.onClose?.(); }
    });
    this.built = true;
  }
  hint() {
    if (!this.foot || !native()) return;
    this.foot.textContent = this.focus
      ? 'Le jeu continue. Échap ou ✕ : reprendre la main · « Se connecter » (YouTube) ou « Connexion » (Twitch) : la connexion reste sur cette tablette'
      : 'Tablette en main : U (ou clic droit) pour la prendre en main et cliquer dessus';
  }
  // (le site affiché : son bouton allumé, la recherche se fait chez lui)
  setSite(site) {
    if (!SITES[site]) return;
    this.site = site;
    this.root.querySelectorAll('.tab-site').forEach((b) => b.classList.toggle('on', b.dataset.a === site));
    if (native()) this.url.placeholder = 'Rechercher sur ' + SITES[site].name + ', ou coller un lien';
  }
  // (web : l'écran vide, avant qu'on colle un lien)
  blank() {
    this.view.removeAttribute('src');
    this.view.srcdoc = '<body style="margin:0;display:grid;place-items:center;height:100vh;background:#0e1620;color:#9ab;font:15px system-ui">Colle le lien d\'une vidéo ou d\'un live YouTube ou Twitch en haut</body>';
  }
  go(url) {
    if (native()) { const p = this.view.loadURL?.(url); if (p) p.catch(() => {}); else this.view.setAttribute('src', url); return; }
    const id = videoId(url), tw = id ? null : twitchOf(url);
    if (!id && !tw) { this.foot.textContent = 'Ce n\'est pas un lien de vidéo YouTube ou de chaîne Twitch (exemples : https://www.youtube.com/watch?v=..., https://www.twitch.tv/nom)'; return; }
    this.view.removeAttribute('srcdoc');
    // (le lecteur de Twitch demande le nom du site qui l'accueille : parent)
    this.view.src = id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&enablejsapi=1`
      : `https://player.twitch.tv/?${tw.video ? 'video=' + tw.video : 'channel=' + encodeURIComponent(tw.channel)}&parent=${encodeURIComponent(location.hostname)}&autoplay=true`;
  }
  act(a) {
    const v = this.view;
    if (a === 'close') { this.onClose?.(); return; }
    if (!native()) {
      if (a === 'home') { this.url.value = ''; this.blank(); }
      else if (a === 'reload') v.src = v.src; // eslint-disable-line no-self-assign
      else if (a === 'go') this.go(this.url.value);
      return;
    }
    try {
      if (a === 'back' && v.canGoBack()) v.goBack();
      else if (a === 'fwd' && v.canGoForward()) v.goForward();
      else if (a === 'reload') v.reload();
      else if (a === 'youtube' || a === 'twitch') { this.setSite(a); this.go(SITES[a].home); }
      else if (a === 'lives') this.go(SITES[this.site].lives);
      else if (a === 'subs') this.go(SITES[this.site].subs);
      else if (a === 'go') { this.go(addressOf(this.url.value, this.site)); this.url.blur(); }
    } catch { /* la page n'est pas encore prête */ }
  }
  // Prise en main (on clique et on tape dessus ; le jeu continue) ou non (elle reste tenue, on
  // voit la vidéo, on joue normalement)
  setFocus(on) {
    if (!this.built) this.build();
    this.focus = !!on;
    this.root.classList.toggle('focus', this.focus);
    this.hint();
    if (this.focus) setTimeout(() => this.view?.focus(), 60);
    else { this.view?.blur?.(); if (document.activeElement && this.root.contains(document.activeElement)) document.activeElement.blur(); }
  }
  // Rangée (plus en main, ou on quitte le monde) : la vidéo se met en pause (elle reprend où elle en était)
  pauseMedia() {
    const v = this.view;
    if (!v) return;
    if (native()) v.executeJavaScript?.("document.querySelectorAll('video').forEach((x) => x.pause())").catch(() => {});
    else v.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }), '*');
  }
  // La page fait-elle du son ? (la musique du jeu se tait alors)
  audible() {
    try { return native() ? !!this.view?.isCurrentlyAudible?.() : !!this.view?.src; } catch { return false; }
  }
  // À chaque image : show (la tablette est tenue et visible), side (-1 : main gauche, 1 : droite),
  // la scène rendue par-dessus le monde, et la page posée sur son écran
  // kept : encore en main mais cachée (menu pause, vue de dos...) : la vidéo et son son continuent
  render(renderer, dt, { show, kept = false, side = -1, aspect = 1, walk = 0, bob = 0, light, ambient } = {}) {
    if (show && !this.built) this.build();
    if (!this.built) return;
    const was = this.kept;
    this.kept = !!(show || kept);
    if (show !== this.shown) {
      this.shown = show;
      this.root.style.visibility = show ? 'visible' : 'hidden';
      if (!show) { if (this.focus) this.onClose?.(); this.k = this.focus ? 1 : 0; }
    }
    if (was && !this.kept) this.pauseMedia();
    if (!show) return;
    this.side = side;
    this.k += ((this.focus ? 1 : 0) - this.k) * Math.min(1, dt * 9);
    const k = this.k, s = k * k * (3 - 2 * k);
    const cam = this.camera;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    // (de près : assez loin pour qu'elle tienne dans l'écran, à 80 % de sa largeur ou 86 % de sa hauteur)
    const vh = 2 * Math.tan((cam.fov * Math.PI) / 360);
    // (de près : 76 % de la largeur ou 74 % de la hauteur, un peu au-dessus du centre : la barre reste visible)
    const dFocus = Math.max(TW / (0.76 * vh * aspect), TH / (0.74 * vh));
    const dHold = Math.max(TW / (0.3 * vh * aspect), TH / (0.36 * vh));
    // (en main : en bas, du côté de la main, tournée vers le centre ; un léger balancement en marchant)
    const hx = side * (0.5 * vh * aspect * dHold - TW * 0.62), hy = -0.5 * vh * dHold + TH * 0.62;
    const bx = Math.sin(walk) * 0.012 * bob, by = -Math.abs(Math.cos(walk)) * 0.012 * bob;
    const m = this.model, d = dHold * (1 - s) + dFocus * s;
    m.position.set((hx + bx) * (1 - s), (hy + by) * (1 - s) + 0.06 * vh * dFocus * s, -d);
    // (tenue droite face à soi : sa page reste un rectangle à l'écran, le plus rapide à afficher ;
    // penchée (réglage) : en perspective, plus joli mais bien plus cher, voir tilt)
    const tl = this.tilt ? 1 - s : 0;
    m.rotation.set(0.16 * tl, -side * 0.32 * tl, side * 0.05 * tl);
    // (tenue : elle reste entière dans la vue, au-dessus de la barre ; le bord tourné vers nous,
    // plus gros en perspective, débordait. Deux petits recadrages, d'après ses coins à l'écran)
    if (s < 0.999) {
      for (let it = 0; it < 2; it++) {
        m.updateMatrixWorld(true);
        let x0 = 9, x1 = -9, y0 = 9;
        for (const c of FRAME) {
          const v = this.tmp.copy(c).applyMatrix4(m.matrixWorld).project(cam);
          x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y);
        }
        const dx = side > 0 ? Math.min(0, 0.97 - x1) : Math.max(0, -0.97 - x0), dy = Math.max(0, -0.78 - y0);
        m.position.x += dx * 0.5 * vh * aspect * d * (1 - s);
        m.position.y += dy * 0.5 * vh * d * (1 - s);
      }
    }
    if (light) { this.light.color.copy(light.color); this.light.intensity = light.intensity; }
    if (ambient) { this.hemi.color.copy(ambient.color); this.hemi.groundColor.copy(ambient.groundColor); this.hemi.intensity = ambient.intensity; }
    m.updateMatrixWorld(true);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, cam);
    renderer.autoClear = true;
    // la page sur l'écran du modèle
    // (la place du canevas : lue une fois, pas à chaque image : la lire force le navigateur à refaire
    // la mise en page si quelque chose a bougé dans l'interface)
    if (!this.rect) { const el = renderer.domElement, b = el.getBoundingClientRect(); this.rect = { x: b.left, y: b.top, w: el.clientWidth, h: el.clientHeight }; }
    const R = this.rect;
    const p = m.userData.corners.map((c) => {
      const v = this.tmp.copy(c).applyMatrix4(m.matrixWorld).project(cam);
      return [R.x + (v.x + 1) / 2 * R.w, R.y + (1 - v.y) / 2 * R.h];
    });
    // (un rectangle droit : un simple déplacement + agrandissement, le plus rapide à afficher ; sinon
    // la page en perspective)
    const flat = Math.abs(p[0][1] - p[1][1]) < 0.05 && Math.abs(p[0][0] - p[3][0]) < 0.05 && Math.abs(p[1][0] - p[2][0]) < 0.05;
    const r2 = (x) => Math.round(x * 100) / 100;
    const tr = flat ? `matrix(${r2((p[1][0] - p[0][0]) / BW * 1e4) / 1e4}, 0, 0, ${r2((p[3][1] - p[0][1]) / BH * 1e4) / 1e4}, ${r2(p[0][0])}, ${r2(p[0][1])})` : quadMatrix(BW, BH, p);
    if (tr !== this.lastTr) { this.root.style.transform = tr; this.lastTr = tr; }
  }
}
