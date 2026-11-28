// L'observatoire (la console du module observatoire, clic droit) : la galaxie vue de dessus, et son
// évolution en accéléré, sur des centaines de millions d'années. C'est une simulation, calculée à
// part : elle ne change rien au monde (le vrai ciel reste celui d'aujourd'hui).
//  - les étoiles tournent autour du centre, presque à la même vitesse partout (230 km/s) : celles du
//    bord font le tour bien plus lentement, et s'éparpillent ;
//  - les bras, eux, restent : ce sont des ondes de densité, qui tournent d'un bloc, plus lentement que
//    les étoiles du centre (le gaz s'y tasse et y fait naître des étoiles). Ils sont dessinés par ce qui
//    y naît sans cesse : les amas d'étoiles bleues et les nuages roses (galaxie.ARMFX), qui vivent
//    quelques millions d'années et renaissent un peu plus loin ;
//  - chaque étoile finit sa vie quand son temps est écoulé : une naine blanche, ou une supernova
//    (un éclair) puis une étoile à neutrons ou un trou noir, pour les plus massives ;
//  - de nouvelles étoiles naissent dans les régions de gaz (les nébuleuses H II) ; les plus chaudes
//    vivent très peu.
// Les satellites de la console : leur état, en haut du panneau.
import { GAL_STARS, GX, GZ, GTYPE, TYPES, CENTER, ARMFX, SOL } from './galaxie.js?v=1.1.0-mx09tneh';
import { hash3 } from './astro.js?v=1.1.0-mx09tneh';
// (la vitesse des bras : 25 km/s par kiloparsec, en radians par an)
const OMEGA_P = 2.56e-8;
import { STAR_TYPES } from './customsys.js?v=1.1.0-mx09tneh';
import { galaxySim } from './astro.js?v=1.1.0-mx09tneh';

const SPEEDS = [[1e6, '1 million d\'années par seconde'], [1e7, '10 millions d\'années par seconde'], [5e7, '50 millions d\'années par seconde']];
const T_MAX = 2e9;
const fmt = (y) => (y >= 1e9 ? (y / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' milliard' + (y >= 2e9 ? 's' : '') + ' d\'années'
  : y >= 1e6 ? Math.round(y / 1e6).toLocaleString('fr-FR') + ' million' + (y >= 2e6 ? 's' : '') + ' d\'années' : Math.round(y).toLocaleString('fr-FR') + ' ans');

export class Observatory {
  constructor() { this.el = null; this.raf = 0; }

  // el : le corps du panneau ; o : { sats: [lignes], onClose }
  open(el, o = {}) {
    this.close();
    this.el = el;
    el.innerHTML = `<div class="obs-head"><h2>Observatoire</h2><span class="obs-sim">Simulation : rien ne change dans ton monde</span><button class="obs-x">Fermer</button></div>
      ${o.sats?.length ? `<div class="obs-sats">${o.sats.map((s) => `<div>${s}</div>`).join('')}</div>` : ''}
      <div class="obs-wrap"><canvas class="obs-cv"></canvas><div class="obs-wait">Calcul de la galaxie...</div></div>
      <div class="obs-bar"><button class="obs-play">Lecture</button><input class="obs-t" type="range" min="0" max="1000" value="0"><span class="obs-time"></span>
        <select class="obs-speed">${SPEEDS.map(([, n], i) => `<option value="${i}"${i === 1 ? ' selected' : ''}>${n}</option>`).join('')}</select><button class="obs-reset">Aujourd'hui</button></div>
      <div class="obs-note">Vue de dessus de la Voie lactée (20 000 étoiles), la galaxie voisine, celle de la Terre : Hexa, elle, est dans Andromède, à 2,5 millions d'années-lumière. Les étoiles tournent autour du centre, celles du bord bien plus lentement : elles s'éparpillent. Les bras restent : ce sont des ondes qui tournent d'un bloc, où le gaz se tasse et fait naître sans cesse des amas d'étoiles bleues et des nuages roses (ils vivent quelques millions d'années). Les étoiles massives meurent vite (éclair : une supernova). Molette : zoom ; glisser : se déplacer.</div>`;
    const cv = el.querySelector('.obs-cv'), wrap = el.querySelector('.obs-wrap');
    this.cv = cv;
    this.t = 0; this.play = false; this.speed = SPEEDS[1][0]; this.zoom = 1; this.pan = { x: 0, z: 0 };
    const playB = el.querySelector('.obs-play'), range = el.querySelector('.obs-t'), timeEl = el.querySelector('.obs-time');
    el.querySelector('.obs-x').onclick = () => o.onClose?.();
    playB.onclick = () => { this.play = !this.play; if (this.t >= T_MAX) this.t = 0; playB.textContent = this.play ? 'Pause' : 'Lecture'; };
    range.oninput = () => { this.t = (range.value / 1000) * T_MAX; };
    el.querySelector('.obs-speed').onchange = (e) => { this.speed = SPEEDS[+e.target.value][0]; };
    el.querySelector('.obs-reset').onclick = () => { this.t = 0; range.value = 0; };
    cv.onwheel = (e) => { e.preventDefault(); this.zoom = Math.max(0.6, Math.min(40, this.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2))); };
    let drag = null;
    cv.onpointerdown = (e) => { drag = { x: e.clientX, y: e.clientY, px: this.pan.x, pz: this.pan.z }; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = (e) => { if (drag) { const s = this.scale(); this.pan.x = drag.px - (e.clientX - drag.x) / s; this.pan.z = drag.pz - (e.clientY - drag.y) / s; } };
    cv.onpointerup = () => { drag = null; };
    // (le calcul des vies des étoiles prend un instant : après le premier affichage)
    setTimeout(() => {
      if (this.el !== el) return;
      this.sim = galaxySim();
      el.querySelector('.obs-wait').remove();
      let last = performance.now();
      const loop = (now) => {
        if (this.el !== el) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const W = Math.max(200, wrap.clientWidth | 0), H = Math.max(200, wrap.clientHeight | 0);
        if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; this.img = null; }
        if (this.play) {
          const t0 = this.t;
          this.t = Math.min(T_MAX, this.t + this.speed * dt);
          this.win = this.t - t0;
          if (this.t >= T_MAX) { this.play = false; playB.textContent = 'Lecture'; }
          range.value = Math.round((this.t / T_MAX) * 1000);
        } else this.win = 0;
        timeEl.textContent = this.t < 1 ? 'Aujourd\'hui' : 'Dans ' + fmt(this.t);
        this.draw();
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }, 30);
  }
  scale() { return (Math.min(this.cv.width, this.cv.height) / 2 / 36000) * this.zoom; }

  draw() {
    const cv = this.cv, W = cv.width, H = cv.height, x = cv.getContext('2d'), S = this.sim, t = this.t;
    if (!this.img) this.img = x.createImageData(W, H);
    const D = this.img.data;
    D.fill(0);
    for (let k = 3; k < D.length; k += 4) D[k] = 255;
    const s = this.scale(), cx = W / 2 - this.pan.x * s, cy = H / 2 - this.pan.z * s;
    const add = (px, py, r, g, b) => {
      px |= 0; py |= 0;
      if (px < 0 || py < 0 || px >= W || py >= H) return;
      const j = (py * W + px) * 4;
      D[j] = Math.min(255, D[j] + r); D[j + 1] = Math.min(255, D[j + 1] + g); D[j + 2] = Math.min(255, D[j + 2] + b);
    };
    const flashes = [];
    const col = (this._col ||= TYPES.map((ty) => { const c = STAR_TYPES[ty]?.couleur || '#ffffff', n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }));
    for (let i = 0; i < GAL_STARS; i++) {
      const R = S.R[i], a = S.A[i] + (S.V_LY / R) * t, px = cx + Math.cos(a) * R * s, py = cy + Math.sin(a) * R * s;
      const ty = GTYPE[i], end = S.END[i];
      let c = col[ty], k = ty === 5 || ty === 6 ? 1 : ty === 0 ? 0.35 : 0.6;
      if (t > end && end > 0) {
        // (sa vie est finie : un reste ; juste après, l'éclair d'une supernova)
        const f = S.FATE[i];
        if (f >= 2 && t - end < Math.max(this.win * 3, 2e6)) flashes.push([px, py]);
        if (f === 3) continue;
        c = f === 2 ? [180, 140, 255] : [235, 240, 255];
        k = f === 2 ? 0.25 : 0.2;
      }
      add(px, py, c[0] * k, c[1] * k, c[2] * k);
    }
    // les bras : amas bleus et nuages roses, qui suivent l'onde (et renaissent : un cycle de 15 millions d'années)
    const F = ARMFX, A0 = (this._a0 ||= Float32Array.from({ length: F.n }, (_, i) => Math.atan2(F.Z[i] - CENTER.z, F.X[i] - CENTER.x)));
    const Rr = (this._r0 ||= Float32Array.from({ length: F.n }, (_, i) => Math.hypot(F.X[i] - CENTER.x, F.Z[i] - CENTER.z)));
    for (let i = 0; i < F.n; i++) {
      const cyc = t / 1.5e7 + hash3(i, 77), c = Math.floor(cyc), ph = cyc - c;
      const life = ph < 0.1 ? ph / 0.1 : ph < 0.7 ? 1 : ph < 0.8 ? (0.8 - ph) / 0.1 : 0;
      if (life <= 0) continue;
      const a = A0[i] + OMEGA_P * t + (c ? (hash3(i, c) - 0.5) * 0.06 : 0), R = Rr[i] * (c ? 1 + (hash3(i, c, 5) - 0.5) * 0.04 : 1);
      const px = cx + Math.cos(a) * R * s, py = cy + Math.sin(a) * R * s;
      if (F.K[i]) { add(px, py, 70 * life, 95 * life, 160 * life); add(px + 1, py, 40 * life, 55 * life, 100 * life); }
      else {
        const k = life * 70;
        add(px, py, k * 1.4, k * 0.45, k * 0.7);
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) add(px + ox, py + oy, k * 0.6, k * 0.2, k * 0.32);
      }
    }
    // les étoiles nées dans les nébuleuses (les chaudes vivent 20 millions d'années)
    for (const b of S.born) {
      if (t < b.t || (b.hot && t > b.t + 2e7)) continue;
      const a = b.A + (S.V_LY / b.R) * t, px = cx + Math.cos(a) * b.R * s, py = cy + Math.sin(a) * b.R * s;
      if (b.hot) add(px, py, 150, 190, 255); else add(px, py, 170, 150, 110);
    }
    x.putImageData(this.img, 0, 0);
    // les supernovas : des éclairs
    x.globalCompositeOperation = 'lighter';
    for (const [px, py] of flashes.slice(0, 400)) {
      const g = x.createRadialGradient(px, py, 0, px, py, 7);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(160,190,255,0)');
      x.fillStyle = g; x.fillRect(px - 7, py - 7, 14, 14);
    }
    x.globalCompositeOperation = 'source-over';
    // le centre, et le Soleil (qui tourne avec les autres ; Hexa est dans Andromède)
    x.strokeStyle = 'rgba(255,210,140,0.7)'; x.fillStyle = '#ffd890'; x.font = '12px sans-serif';
    x.beginPath(); x.arc(cx, cy, 4, 0, Math.PI * 2); x.stroke();
    x.fillText('Sagittarius A*', cx + 7, cy - 6);
    const hR = Math.hypot(SOL.x - CENTER.x, SOL.z - CENTER.z), hA = Math.atan2(SOL.z - CENTER.z, SOL.x - CENTER.x) + (S.V_LY / hR) * t;
    const hx = cx + Math.cos(hA) * hR * s, hy = cy + Math.sin(hA) * hR * s;
    x.strokeStyle = '#7fe0ff'; x.fillStyle = '#7fe0ff';
    x.beginPath(); x.arc(hx, hy, 6, 0, Math.PI * 2); x.stroke();
    x.fillText('Soleil', hx + 9, hy + 4);
    // (combien de tours le Soleil a faits)
    const turns = ((S.V_LY / hR) * t) / (Math.PI * 2);
    if (t > 0) { x.fillStyle = 'rgba(200,220,255,0.75)'; x.fillText(`Le Soleil a fait ${turns.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} tour${turns >= 2 ? 's' : ''} de la galaxie (un tour : ${fmt((Math.PI * 2 * hR) / S.V_LY)})`, 10, H - 12); }
  }

  close() {
    cancelAnimationFrame(this.raf);
    if (this.el) this.el.innerHTML = '';
    this.el = null;
    this.sim = null;
  }
}
