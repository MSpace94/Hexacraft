// Touches du jeu : chaque action a une touche, qu'on peut changer (Options > Touches et souris).
// Les touches sont gardées par position sur le clavier (code physique, KeyW = la touche en haut
// à gauche des lettres) : la même configuration marche en AZERTY et en QWERTY. On affiche le
// nom de la touche tel qu'il est écrit sur le clavier du joueur (détecté, ou choisi : AZERTY /
// QWERTY). Les flèches, Entrée, Échap, F5 et les chiffres restent toujours actifs.

// [action, nom affiché, touche par défaut]
export const ACTIONS = [
  ['forward', 'Avancer', 'KeyW'],
  ['back', 'Reculer', 'KeyS'],
  ['left', 'Aller à gauche', 'KeyA'],
  ['right', 'Aller à droite', 'KeyD'],
  ['jump', 'Sauter (double appui : voler en créatif)', 'Space'],
  ['down', 'Descendre / s\'accroupir / quitter l\'Hexacart', 'ShiftLeft'],
  ['sprint', 'Courir', 'ControlLeft'],
  ['inventory', 'Inventaire (en visant un carton : le ramasser ; maintenu : collecte automatique)', 'KeyE'],
  ['drop', 'Jeter l\'objet tenu, dans un carton (Ctrl : toute la pile)', 'KeyQ'],
  ['chat', 'Ouvrir le chat', 'KeyT'],
  ['players', 'Liste des joueurs (multijoueur)', 'Tab'],
  ['voice', 'Parler au chat vocal (maintenu)', 'KeyB'],
  ['view', 'Changer de vue', 'KeyV'],
  ['grabAxis', 'Main gravitationnelle : changer d\'axe', 'KeyR'],
  ['grabStraight', 'Main gravitationnelle : redresser l\'objet', 'KeyX'],
  ['autopilot', 'Train : pilote automatique (dans la cabine)', 'KeyP'],
  ['whistle', 'Train : sifflet (dans la cabine)', 'KeyH'],
  ['debug', 'Infos de débogage', 'F3'],
];
export const DEFAULT_KEYS = Object.fromEntries(ACTIONS.map(([a, , k]) => [a, k]));

// Touches qu'on ne peut pas prendre (réservées)
export const RESERVED = new Set(['Escape', 'Enter', 'NumpadEnter', 'F1', 'F5', 'F11', 'MetaLeft', 'MetaRight',
  'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

let binds = { ...DEFAULT_KEYS };
let layout = 'auto';       // 'auto' | 'azerty' | 'qwerty'
let detected = null;       // carte du clavier (navigateur), si disponible

// Touches choisies (options.keys) : on garde les actions connues, avec une touche valable
export function setBindings(saved) {
  binds = { ...DEFAULT_KEYS };
  if (saved && typeof saved === 'object') {
    for (const [a] of ACTIONS) if (typeof saved[a] === 'string' && /^[A-Za-z0-9]{2,24}$/.test(saved[a]) && !RESERVED.has(saved[a])) binds[a] = saved[a];
  }
  return binds;
}
export const bindings = () => binds;
export const keyOf = (action) => binds[action];

// La touche e (événement clavier) est-elle celle de l'action ?
export function is(e, action) {
  const code = typeof e === 'string' ? e : e.code;
  if (code === binds[action]) return true;
  // (les deux Maj, les deux Ctrl se valent)
  const twin = { ShiftLeft: 'ShiftRight', ShiftRight: 'ShiftLeft', ControlLeft: 'ControlRight', ControlRight: 'ControlLeft' }[binds[action]];
  return code === twin;
}
// Action maintenue (keys : touches enfoncées)
export function held(keys, action) {
  const c = binds[action];
  if (keys.has(c)) return true;
  const twin = { ShiftLeft: 'ShiftRight', ShiftRight: 'ShiftLeft', ControlLeft: 'ControlRight', ControlRight: 'ControlLeft' }[c];
  return !!twin && keys.has(twin);
}

// Changer la touche d'une action ; une autre action qui l'avait prend l'ancienne (échange)
export function rebind(action, code) {
  if (RESERVED.has(code) || !(action in binds)) return false;
  const other = Object.keys(binds).find((a) => a !== action && binds[a] === code);
  if (other) binds[other] = binds[action];
  binds[action] = code;
  return true;
}

// ---------- Noms des touches ----------
export function setLayout(l) { layout = l === 'azerty' || l === 'qwerty' ? l : 'auto'; }
export const getLayout = () => layout;
// Le navigateur sait parfois quel clavier est branché (Chrome / Electron)
export async function detectLayout() {
  try { detected = await navigator.keyboard?.getLayoutMap?.(); } catch { detected = null; }
  return detected;
}
// Disposition utilisée pour les noms : choisie, sinon détectée (z en haut à gauche : AZERTY)
export function activeLayout() {
  if (layout !== 'auto') return layout;
  const k = detected?.get?.('KeyW');
  return k === 'z' ? 'azerty' : 'qwerty';
}
const AZERTY = { KeyQ: 'A', KeyW: 'Z', KeyA: 'Q', KeyZ: 'W', KeyM: ',', Semicolon: 'M', Comma: ';', Period: ':', Slash: '!' };
const NAMED = {
  Space: 'Espace', ShiftLeft: 'Maj', ShiftRight: 'Maj droite', ControlLeft: 'Ctrl', ControlRight: 'Ctrl droite',
  AltLeft: 'Alt', AltRight: 'Alt Gr', Tab: 'Tab', CapsLock: 'Verr. maj', Backspace: 'Retour arrière', Enter: 'Entrée',
  Backquote: '²', Minus: ')', Equal: '=', BracketLeft: '^', BracketRight: '$', Backslash: '*', Quote: 'ù', IntlBackslash: '<',
  Insert: 'Inser', Delete: 'Suppr', Home: 'Début', End: 'Fin', PageUp: 'Page préc.', PageDown: 'Page suiv.',
};
// Nom d'une touche (code physique) sur le clavier du joueur
export function keyName(code) {
  if (!code) return '—';
  if (/^F\d+$/.test(code)) return code;
  if (/^Numpad/.test(code)) return 'Pavé ' + code.slice(6);
  if (NAMED[code] && !(code in AZERTY)) {
    // (ces signes changent avec le clavier : en QWERTY on prend le signe américain)
    if (activeLayout() === 'qwerty' && ['Backquote', 'Minus', 'BracketLeft', 'BracketRight', 'Backslash', 'Quote'].includes(code)) return { Backquote: '`', Minus: '-', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Quote: '\'' }[code];
    return NAMED[code];
  }
  const lay = activeLayout();
  if (layout === 'auto' && detected?.get?.(code)) {
    const k = detected.get(code);
    return k.length === 1 ? k.toUpperCase() : k;
  }
  if (lay === 'azerty' && AZERTY[code]) return AZERTY[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  return { Semicolon: ';', Comma: ',', Period: '.', Slash: '/' }[code] || code;
}
// Nom de la touche d'une action
export const actionKey = (action) => keyName(binds[action]);
// Les quatre touches de déplacement, par exemple « Z Q S D »
export const moveKeys = () => ['forward', 'left', 'back', 'right'].map(actionKey).join(' ');
