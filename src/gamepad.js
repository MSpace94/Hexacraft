// Manette (Xbox, PlayStation, Switch Pro, Steam Deck... : la disposition « standard » du
// navigateur). Comme pour les commandes tactiles (voir touch.js), le jeu ne voit que ses entrées
// habituelles : touches maintenues, appuis, clics, mouvements du regard.
//  En jeu :
//   - stick gauche : se déplacer (en analogique : à moitié poussé, on marche moins vite) ;
//     clic du stick gauche : courir
//   - stick droit : regarder ; clic du stick droit : choisir le bloc visé (menu de la locomotive)
//   - RT : casser / frapper (maintenu : miner) ; LT : poser / utiliser
//   - A : sauter (deux fois : voler en créatif) ; B : s'accroupir / descendre
//   - X : inventaire ; Y : changer de vue
//   - LB / RB, croix gauche / droite : case de la barre ; croix bas : jeter ; croix haut : joueurs
//   - Start : pause ; Select : chat
//  Dans les menus : un curseur. Stick gauche (ou croix) : le déplacer ; A : cliquer ; X : clic
//  droit (inventaire de survie : la moitié d'une pile) ; B : retour ; stick droit : faire défiler.

const DEAD = 0.18;          // zone morte des sticks
const LOOK_SPEED = 3.2;     // regard : radians par seconde, stick à fond (sensibilité 100 %)
const CURSOR_SPEED = 1100;  // curseur des menus : pixels par seconde, stick à fond
const SCROLL_SPEED = 900;   // défilement des menus : pixels par seconde
const REPEAT_MS = 260;      // croix maintenue dans un menu : le curseur avance par pas

// boutons de la disposition standard
const A = 0, B = 1, X = 2, Y = 3, LB = 4, RB = 5, LT = 6, RT = 7, SELECT = 8, START = 9, L3 = 10, R3 = 11;
const UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;

// Stick : zone morte, puis réponse progressive (précis au centre, rapide à fond)
const axis = (v) => {
  const a = Math.abs(v);
  if (a < DEAD) return 0;
  const t = (a - DEAD) / (1 - DEAD);
  return Math.sign(v) * t * t;
};

// api : { playing(), hold(action, on), key(action, down), mouse(button, down), look(dx, dy) en
// radians, selectSlot(delta), pause(), back(), resume(), sens() (sensibilité, %), toast(text) }
export function createGamepad(api) {
  const cursor = document.createElement('div');
  cursor.id = 'pad-cursor';
  cursor.hidden = true;
  document.body.appendChild(cursor);

  const g = {
    using: false,          // la manette sert (dernière entrée utilisée) : pas de souris à capturer
    stick: { x: 0, z: 0 }, // déplacement analogique (comme le joystick tactile)
    sprint: false,
  };
  let prev = [];           // boutons de l'image d'avant
  let wasPlaying = false;
  const cur = { x: innerWidth / 2, y: innerHeight / 2 };
  let hoverEl = null, repeatAt = 0;
  const held = new Set();  // actions maintenues

  function hold(action, on) {
    if (on === held.has(action)) return;
    if (on) held.add(action); else held.delete(action);
    api.hold(action, on);
  }
  function press(action) { api.key(action, true); api.key(action, false); }
  function releaseAll() {
    for (const a of [...held]) hold(a, false);
    if (held.mouseL) { api.mouse(0, false); held.mouseL = false; }
    if (held.mouseR) { api.mouse(2, false); held.mouseR = false; }
    if (held.jump) { api.key('jump', false); held.jump = false; }
    if (held.down) { api.key('down', false); held.down = false; }
    g.stick.x = g.stick.z = 0;
    g.sprint = false;
  }

  // ---------- Curseur des menus ----------
  function fire(type, el, extra = {}) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: type !== 'mouseenter' && type !== 'mouseleave', cancelable: true, clientX: cur.x, clientY: cur.y, view: window, ...extra }));
  }
  function under() {
    cursor.style.visibility = 'hidden'; // (le curseur lui-même n'est pas visé)
    const el = document.elementFromPoint(cur.x, cur.y);
    cursor.style.visibility = '';
    return el;
  }
  function moveCursor(dx, dy) {
    cur.x = Math.max(0, Math.min(innerWidth - 1, cur.x + dx));
    cur.y = Math.max(0, Math.min(innerHeight - 1, cur.y + dy));
    cursor.style.transform = `translate(${cur.x}px, ${cur.y}px)`;
    const el = under();
    if (el !== hoverEl) {
      if (hoverEl) { fire('mouseout', hoverEl); fire('mouseleave', hoverEl); }
      hoverEl = el;
      if (el) { fire('mouseover', el); fire('mouseenter', el); }
    }
    if (el) fire('mousemove', el);
  }
  function click(button) {
    const el = under();
    if (!el) return;
    // curseur sur un réglage (glissière) : A ne fait rien, la croix le règle (voir nudge)
    fire('mousedown', el, { button, buttons: button === 2 ? 2 : 1 });
    fire('mouseup', el, { button });
    if (button === 0) {
      fire('click', el, { button });
      if (el.matches('input, textarea, select')) el.focus();
    } else fire('contextmenu', el, { button });
  }
  // croix gauche / droite sur une glissière : la régler d'un cran
  function nudge(dir) {
    const el = under();
    if (!el || el.tagName !== 'INPUT' || el.type !== 'range') return false;
    const step = Number(el.step) || 1;
    el.value = String(Math.max(Number(el.min) || 0, Math.min(Number(el.max) || 100, Number(el.value) + dir * step)));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  function scrollUnder(dy) {
    let el = under();
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(el).overflowY)) { el.scrollTop += dy; return; }
      el = el.parentElement;
    }
  }

  // ---------- Chaque image ----------
  g.update = function (dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected && (!pad || p.timestamp > pad.timestamp)) pad = p;
    if (!pad) {
      if (g.using) { releaseAll(); g.using = false; cursor.hidden = true; }
      return;
    }
    const btn = pad.buttons.map((b) => b.pressed || b.value > 0.5);
    const down = (i) => btn[i] && !prev[i];
    const lx = axis(pad.axes[0] || 0), ly = axis(pad.axes[1] || 0), rx = axis(pad.axes[2] || 0), ry = axis(pad.axes[3] || 0);
    // la manette sert dès qu'on la touche ; la souris reprend la main dès qu'elle bouge (main.js)
    if (btn.some(Boolean) || lx || ly || rx || ry) {
      if (!g.using) api.toast?.('Manette : A sauter, RT casser, LT poser, X inventaire, Start pause');
      g.using = true;
    }
    if (!g.using) { prev = btn; return; }

    const playing = api.playing();
    if (playing !== wasPlaying) {
      releaseAll();
      wasPlaying = playing;
      if (!playing) { cursor.hidden = false; moveCursor(0, 0); }
    }
    cursor.hidden = playing;

    if (playing) {
      // déplacement : analogique, et les touches pour le reste du jeu (locomotive...)
      g.stick.x = lx;
      g.stick.z = ly;
      hold('forward', ly < -0.3);
      hold('back', ly > 0.3);
      hold('left', lx < -0.3);
      hold('right', lx > 0.3);
      // courir : clic du stick gauche, jusqu'à ce qu'on lâche le stick
      if (down(L3)) g.sprint = true;
      if (Math.hypot(lx, ly) < 0.2) g.sprint = false;
      // regard
      if (rx || ry) {
        const k = LOOK_SPEED * (api.sens() / 100) * dt;
        api.look(rx * k, ry * k);
      }
      // gâchettes : clics maintenus
      if (btn[RT] !== !!held.mouseL) { held.mouseL = btn[RT]; api.mouse(0, btn[RT]); }
      if (btn[LT] !== !!held.mouseR) { held.mouseR = btn[LT]; api.mouse(2, btn[LT]); }
      // sauter, descendre : touches maintenues (le double appui pour voler marche aussi)
      if (btn[A] !== !!held.jump) { held.jump = btn[A]; api.key('jump', btn[A]); }
      if (btn[B] !== !!held.down) { held.down = btn[B]; api.key('down', btn[B]); }
      if (down(X)) press('inventory');
      if (down(Y)) press('view');
      if (down(R3)) { api.mouse(1, true); api.mouse(1, false); }
      if (down(LB) || down(LEFT)) api.selectSlot(-1);
      if (down(RB) || down(RIGHT)) api.selectSlot(1);
      if (down(DOWN)) press('drop');
      if (btn[UP] !== held.has('players')) hold('players', btn[UP]);
      if (down(SELECT)) { releaseAll(); press('chat'); }
      if (down(START)) { releaseAll(); api.pause(); }
    } else {
      // menus : le curseur
      const sp = CURSOR_SPEED * dt;
      if (lx || ly) moveCursor(lx * sp, ly * sp);
      const now = performance.now();
      for (const [b, dx, dy] of [[UP, 0, -1], [DOWN, 0, 1], [LEFT, -1, 0], [RIGHT, 1, 0]]) {
        if (down(b) || (btn[b] && now >= repeatAt && prev[b])) {
          if (down(b)) repeatAt = now + REPEAT_MS * 1.6; else repeatAt = now + REPEAT_MS;
          if (dx && nudge(dx)) continue;
          moveCursor(dx * 48, dy * 48);
        }
      }
      if (ry) scrollUnder(ry * SCROLL_SPEED * dt);
      if (down(A)) click(0);
      if (down(X)) click(2);
      if (down(B)) api.back();
      if (down(START)) api.resume();
      if (down(LB)) api.selectSlot(-1);
      if (down(RB)) api.selectSlot(1);
    }
    prev = btn;
  };

  // la souris (ou le clavier) reprend la main : plus de curseur de la manette
  g.mouseUsed = function () {
    if (!g.using) return;
    releaseAll();
    g.using = false;
    cursor.hidden = true;
  };

  // Vibration (dégâts...) : intensité 0..1, durée en ms
  g.rumble = function (strength = 0.6, ms = 160) {
    if (!g.using) return;
    for (const p of navigator.getGamepads ? navigator.getGamepads() : []) {
      try { p?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }); } catch { /* ignoré */ }
    }
  };

  addEventListener('gamepadconnected', (e) => api.toast?.(`Manette connectée : ${String(e.gamepad.id).replace(/\s*\(.*$/, '').slice(0, 40)}`));
  return g;
}
