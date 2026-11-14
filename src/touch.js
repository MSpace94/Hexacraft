// Commandes tactiles (iPad, tablettes, téléphones) : pas de clavier ni de souris.
//  - côté gauche : un joystick qui apparaît sous le doigt (poussé à fond vers l'avant : courir)
//  - ailleurs : glisser pour regarder ; toucher : poser / utiliser (clic droit) ;
//    appui long : casser (clic gauche maintenu) ; toucher un animal ou un joueur : le frapper
//  - des boutons : sauter (deux fois : voler en créatif), s'accroupir / descendre, inventaire,
//    jeter, changer de vue, chat, choisir le bloc visé (clic molette : menu de la locomotive), pause
//  - la barre d'objets se touche directement
// Le jeu ne voit que ses entrées habituelles : touches maintenues, clics, mouvements du regard
// (voir les fonctions données par main.js).

const HOLD_MS = 280;  // appui long : casser
const MOVE_PX = 12;   // au-delà, le doigt regarde (ce n'est plus un toucher)
const STICK_R = 60;   // rayon du joystick, en pixels

// Appareil tactile sans souris : iPad, tablette, téléphone (un PC tactile garde sa souris)
export const touchDevice = () => (navigator.maxTouchPoints || 0) > 0 && matchMedia('(pointer: coarse)').matches;

export function createTouch(api) {
  const root = document.createElement('div');
  root.id = 'touch';
  root.hidden = true;
  root.innerHTML = `
    <div class="t-stick" hidden><i></i></div>
    <div class="t-top">
      <button data-a="pause" title="Pause">II</button>
      <button data-a="chat" title="Chat">Chat</button>
      <button data-a="view" title="Vue">Vue</button>
    </div>
    <div class="t-side">
      <button data-a="inventory" title="Inventaire">Sac</button>
      <button data-a="drop" title="Jeter">Jeter</button>
      <button data-a="pick" title="Choisir">◎</button>
    </div>
    <div class="t-pad">
      <button data-a="down" class="t-down" title="S'accroupir / descendre">▼</button>
      <button data-a="jump" class="t-jump" title="Sauter">▲</button>
    </div>`;
  document.body.appendChild(root);
  const close = document.createElement('button');
  close.id = 'touch-close';
  close.hidden = true;
  close.textContent = '✕';
  close.title = 'Fermer';
  document.body.appendChild(close);

  const stickEl = root.querySelector('.t-stick'), knob = stickEl.querySelector('i');
  const pickBtn = root.querySelector('[data-a="pick"]');
  const t = {
    on: false,     // commandes tactiles en service
    active: false, // en jeu (on joue : pas de menu)
    stick: { x: 0, z: 0 },
    get sprint() { return Math.hypot(this.stick.x, this.stick.z) > 0.92 && this.stick.z < -0.6; },
  };
  const fingers = new Map(); // identifiant du doigt -> { role, x, y, x0, y0, t0, timer }
  const held = new Set();    // actions maintenues par le joystick et les boutons

  function hold(action, on) {
    if (on === held.has(action)) return;
    if (on) held.add(action); else held.delete(action);
    api.hold(action, on);
  }
  function setStick(dx, dy) {
    const len = Math.hypot(dx, dy), k = len > STICK_R ? STICK_R / len : 1;
    dx *= k; dy *= k;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    t.stick.x = dx / STICK_R;
    t.stick.z = dy / STICK_R;
    // (les autres parties du jeu, la locomotive par exemple, lisent les touches)
    hold('forward', t.stick.z < -0.35);
    hold('back', t.stick.z > 0.35);
    hold('left', t.stick.x < -0.35);
    hold('right', t.stick.x > 0.35);
  }
  function releaseAll() {
    for (const f of fingers.values()) { clearTimeout(f.timer); if (f.role === 'break') api.mouse(0, false); }
    fingers.clear();
    stickEl.hidden = true;
    setStick(0, 0);
    for (const a of [...held]) hold(a, false);
    root.querySelectorAll('button.down').forEach((b) => b.classList.remove('down'));
  }

  // ---------- Joystick et regard (les doigts posés hors des boutons) ----------
  root.addEventListener('touchstart', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault(); // (pas de clic de souris imité ensuite, pas de zoom)
    for (const tc of e.changedTouches) {
      const left = tc.clientX < innerWidth * 0.4 && tc.clientY > innerHeight * 0.3;
      if (left && ![...fingers.values()].some((f) => f.role === 'stick')) {
        fingers.set(tc.identifier, { role: 'stick', x0: tc.clientX, y0: tc.clientY });
        stickEl.hidden = false;
        stickEl.style.left = tc.clientX + 'px';
        stickEl.style.top = tc.clientY + 'px';
        setStick(0, 0);
        continue;
      }
      const f = { role: 'look', x: tc.clientX, y: tc.clientY, x0: tc.clientX, y0: tc.clientY, t0: performance.now(), moved: false };
      // (appui long sans bouger : on casse, en continuant de viser avec le doigt)
      f.timer = setTimeout(() => { if (f.role === 'look' && !f.moved) { f.role = 'break'; api.mouse(0, true); } }, HOLD_MS);
      fingers.set(tc.identifier, f);
    }
  }, { passive: false });
  root.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const tc of e.changedTouches) {
      const f = fingers.get(tc.identifier);
      if (!f) continue;
      if (f.role === 'stick') { setStick(tc.clientX - f.x0, tc.clientY - f.y0); continue; }
      if (!f.moved && Math.hypot(tc.clientX - f.x0, tc.clientY - f.y0) > MOVE_PX) f.moved = true;
      if (f.moved || f.role === 'break') api.look(tc.clientX - f.x, tc.clientY - f.y);
      f.x = tc.clientX;
      f.y = tc.clientY;
    }
  }, { passive: false });
  function fingerUp(e) {
    e.preventDefault();
    for (const tc of e.changedTouches) {
      const f = fingers.get(tc.identifier);
      if (!f) continue;
      fingers.delete(tc.identifier);
      clearTimeout(f.timer);
      if (f.role === 'stick') { stickEl.hidden = true; setStick(0, 0); }
      else if (f.role === 'break') api.mouse(0, false);
      else if (!f.moved && e.type === 'touchend') {
        // un toucher : frapper ce qu'on vise (animal, joueur), sinon poser / utiliser
        const b = api.aimsAtCreature() ? 0 : 2;
        api.mouse(b, true);
        api.mouse(b, false);
      }
    }
  }
  root.addEventListener('touchend', fingerUp, { passive: false });
  root.addEventListener('touchcancel', fingerUp, { passive: false });

  // ---------- Boutons ----------
  const HOLD = new Set(['jump', 'down']);
  root.querySelectorAll('button').forEach((b) => {
    const a = b.dataset.a;
    b.addEventListener('touchstart', (e) => {
      e.preventDefault();
      b.classList.add('down');
      if (HOLD.has(a)) { api.key(a, true); held.add(a); return; }
      if (a === 'pause') { releaseAll(); api.pause(); return; }
      if (a === 'pick') { api.mouse(1, true); api.mouse(1, false); return; }
      if (a === 'chat') { releaseAll(); api.key(a, true); api.key(a, false); return; }
      api.key(a, true);
      api.key(a, false);
    }, { passive: false });
    const up = (e) => {
      e.preventDefault();
      b.classList.remove('down');
      if (HOLD.has(a) && held.has(a)) { held.delete(a); api.key(a, false); }
    };
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });
  });
  // Fermer le menu ouvert (inventaire, coffre, établi...) : comme Échap
  close.addEventListener('click', () => api.escape());

  // La barre d'objets : toucher une case la choisit
  function hookHotbar(els) {
    els.forEach((el, i) => el.addEventListener('touchstart', (e) => {
      if (!t.active) return;
      e.preventDefault();
      api.selectSlot(i);
    }, { passive: false }));
  }

  t.hookHotbar = hookHotbar;
  t.setEnabled = (on) => {
    t.on = !!on;
    document.body.classList.toggle('touch', t.on);
    if (!t.on) { t.setActive(false); close.hidden = true; }
  };
  // en jeu (rien d'ouvert) : les commandes ; dans un menu : seulement le bouton Fermer
  t.setActive = (on, menu = false) => {
    on = t.on && on;
    close.hidden = !(t.on && menu);
    if (on === t.active) return;
    t.active = on;
    root.hidden = !on;
    if (!on) releaseAll();
  };
  // (le bouton du milieu : le menu de la locomotive dans une cabine)
  t.setPickLabel = (s) => { if (pickBtn.textContent !== s) pickBtn.textContent = s; };
  return t;
}
