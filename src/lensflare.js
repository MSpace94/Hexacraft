// L'éblouissement quand on regarde une étoile en face (voir main.js) : l'écran blanchit autour
// d'elle, et des reflets d'objectif (des hexagones, comme le diaphragme) s'alignent entre l'étoile
// et le centre de l'écran. Rien quand on la regarde de côté, ni quand un bloc la cache.
// Un calque par-dessus le jeu (sans clic), dessiné en CSS : aucun coût pour la carte graphique.
import * as THREE from 'three';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// reflets : [position sur la ligne étoile -> centre (0 : l'étoile, 1 : le centre, 2 : en face), taille (part de la hauteur), force, teinte]
const GHOSTS = [[0.35, 0.05, 0.5, 'c'], [0.7, 0.11, 0.22, 'b'], [1.15, 0.035, 0.45, 'c'], [1.45, 0.16, 0.14, 'v'], [1.8, 0.07, 0.3, 'b'], [2.2, 0.24, 0.1, 'c']];
const TINT = { b: [120, 180, 255], v: [190, 140, 255] };

export class LensFlare {
  constructor(after) {
    const root = document.createElement('div');
    root.id = 'lensflare';
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;mix-blend-mode:screen;display:none';
    this.veil = document.createElement('div');
    this.veil.style.cssText = 'position:absolute;inset:0';
    root.appendChild(this.veil);
    this.ghosts = GHOSTS.map(() => {
      const g = document.createElement('div');
      g.style.cssText = 'position:absolute;left:0;top:0;clip-path:polygon(25% 6.7%,75% 6.7%,100% 50%,75% 93.3%,25% 93.3%,0 50%)';
      root.appendChild(g);
      return g;
    });
    after.after(root);
    this.root = root;
    this.k = 0;
    this._p = new THREE.Vector3();
    this._f = new THREE.Vector3();
    this.color = [255, 244, 220];
  }

  // dir : direction de l'étoile (monde, unitaire) ; strength : 0..1 (déjà tenu compte des nuages,
  // de l'adaptation de l'œil, d'un bloc qui la cache) ; color : sa couleur ; dt : pour adoucir
  update(camera, dir, strength, color, dt) {
    let want = 0, sx = 0, sy = 0;
    if (dir && strength > 0.001) {
      const f = camera.getWorldDirection(this._f), c = f.dot(dir);
      want = strength * smooth(0.8, 0.995, c); // (en face : plein ; à 35° : plus rien)
      // (une direction : sans la position de la caméra, que l'origine flottante décale, voir origin.js)
      const p = this._p.copy(dir).transformDirection(camera.matrixWorldInverse).multiplyScalar(10).applyMatrix4(camera.projectionMatrix);
      if (c < 0.05) want = 0; // (derrière nous : rien)
      sx = (p.x * 0.5 + 0.5) * innerWidth;
      sy = (-p.y * 0.5 + 0.5) * innerHeight;
    }
    // (on est ébloui vite, la vue revient un peu moins vite)
    this.k += (want - this.k) * Math.min(1, dt * (want > this.k ? 10 : 5));
    if (this.k < 0.004) { if (this.root.style.display !== 'none') this.root.style.display = 'none'; return; }
    this.root.style.display = '';
    this.sx = sx; this.sy = sy;
    if (color) this.color = [Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255)];
    const [r, g, b] = this.color, k = this.k, H = innerHeight;
    this.veil.style.background = `radial-gradient(circle at ${sx}px ${sy}px, rgba(255,255,255,${0.85 * k}) 0, rgba(${r},${g},${b},${0.5 * k}) ${H * 0.05}px, rgba(${r},${g},${b},${0.18 * k}) ${H * 0.25}px, rgba(${r},${g},${b},${0.06 * k}) ${H * 0.6}px, rgba(0,0,0,0) ${H * 1.1}px)`;
    const cx = innerWidth / 2, cy = H / 2;
    GHOSTS.forEach(([t, size, a, tint], i) => {
      const el = this.ghosts[i], s = size * H, x = sx + (cx - sx) * t, y = sy + (cy - sy) * t;
      const [tr, tg, tb] = TINT[tint] || this.color;
      el.style.width = el.style.height = `${s}px`;
      el.style.transform = `translate(${x - s / 2}px, ${y - s / 2}px)`;
      el.style.background = `radial-gradient(circle, rgba(${tr},${tg},${tb},${a * k * 0.5}) 0, rgba(${tr},${tg},${tb},${a * k}) 70%, rgba(${tr},${tg},${tb},0) 100%)`;
    });
  }
}
