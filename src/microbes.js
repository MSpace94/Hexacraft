// Les microbes des autres mondes, vus au microscope (clic droit sur un bloc, microscope en main ; ils
// vont dans le carnet d'exploration, onglet Vie). La vie a besoin d'un liquide (un solvant), d'énergie
// et de chimie : ce qu'on trouve dépend de l'endroit, comme sur Terre chez les extrêmophiles :
//  - les sources chaudes, le soufre : des archées thermophiles (comme Sulfolobus), en lobes ;
//  - la glace, la neige : des psychrophiles, en filaments, dans les veines de saumure liquide ;
//  - le sel : des halophiles roses, carrées (comme Haloquadratum : le pigment bactériorhodopsine) ;
//  - un fort rayonnement : des cellules en tétrades, qui réparent leur ADN (comme Deinococcus) ;
//  - le méthane liquide, très froid (comme sur Titan) : des cellules hypothétiques aux membranes
//    d'azote (les « azotosomes ») ;
//  - la roche nue d'un monde sans air : des endolithes, cachés dans les pores de la roche ;
//  - sinon, trop chaud, trop sec, rien de liquide : stérile, rien que des grains minéraux.
// Les cellules bougent au hasard sous l'objectif (le mouvement brownien), les flagellées nagent.
// Ce module n'a pas de three.js.
export const MICROSCOPE = 4620;

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const rng = (seed) => () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x6d2b79f5) >>> 0) / 4294967296;
const latin = (name) => {
  const s = name.split(/\s+/)[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '') || 'ignota';
  return (/[aeiouy]$/.test(s) ? s.slice(0, -1) : s) + 'ensis';
};

const KINDS = {
  thermo: { pre: ['Thermo', 'Pyro', 'Sulfo'], suf: ['lobus', 'coccus', 'sphaera'], shape: 'lobe', colors: ['#e0b040', '#d07a30'], size: 1, motile: 0.2,
    h: 'thermophile', text: "Des archées qui vivent dans l'eau brûlante (au-delà de 80 °C) et tirent leur énergie du soufre. Leurs membranes, faites de lipides soudés, ne fondent pas à la chaleur." },
  psychro: { pre: ['Psychro', 'Cryo', 'Glacio'], suf: ['filum', 'bacter', 'spira'], shape: 'filament', colors: ['#7ad0e0', '#4a90c0'], size: 1, motile: 0.4,
    h: 'psychrophile', text: "Elles vivent dans les minces veines d'eau salée qui restent liquides dans la glace, bien en dessous de 0 °C. Leurs protéines antigel les empêchent de cristalliser." },
  halo: { pre: ['Halo', 'Sali'], suf: ['quadrum', 'rubrum', 'arcula'], shape: 'square', colors: ['#f07090', '#d04060'], size: 1.2, motile: 0.1,
    h: 'halophile', text: 'Des cellules carrées et plates, roses : leur pigment (la bactériorhodopsine) capte la lumière. Elles vivent dans la saumure saturée, où l\'eau est rare pour les autres.' },
  radio: { pre: ['Radio', 'Deino'], suf: ['coccus', 'tetras'], shape: 'tetrad', colors: ['#e05050', '#f08a40'], size: 1, motile: 0.05,
    h: 'radiorésistante', text: "Groupées par quatre, avec plusieurs copies de leur ADN : elles réparent les brins cassés par le rayonnement, qui tuerait n'importe quelle autre cellule." },
  azoto: { pre: ['Azoto', 'Metha', 'Cryo'], suf: ['soma', 'vesicula', 'nitrilia'], shape: 'vesicle', colors: ['#c0a0f0', '#8a70d0'], size: 1.4, motile: 0.15,
    h: 'azotosome (hypothétique)', text: "Dans le méthane liquide, à -180 °C, l'eau est de la roche : ces cellules auraient des membranes d'acrylonitrile (des azotosomes), comme on l'a imaginé pour Titan. Une chimie très lente." },
  litho: { pre: ['Litho', 'Endo', 'Chasmo'], suf: ['phila', 'coccus', 'bacter'], shape: 'coccus', colors: ['#90a070', '#6a7a50'], size: 0.8, motile: 0.02,
    h: 'endolithe', text: "Cachées dans les pores de la roche, à l'abri du rayonnement et du vide, elles survivent sur le peu d'eau que le gel et le dégel y laissent. Elles se divisent une fois par siècle." },
  meso: { pre: ['Hydro', 'Thalasso', 'Aqua'], suf: ['bacter', 'monas', 'cystis'], shape: 'mix', colors: ['#70b0a0', '#a0c070'], size: 1, motile: 0.5,
    h: 'mésophile aquatique', text: "Dans une eau tiède, entre 0 et 40 °C : des bâtonnets qui nagent avec leur flagelle, des algues unicellulaires à coque de verre. La vie la plus facile, celle des mers d'Hexa." },
  home: { pre: ['Bacillus', 'Navicula', 'Saccharo'], suf: [''], shape: 'mix', colors: ['#a0c060', '#d0c080'], size: 1, motile: 0.6,
    h: 'ordinaire', text: "Des bactéries en bâtonnets, des diatomées en coques de verre, quelques levures : la vie de tous les jours d'Hexa." },
};

// env : { body (l'astre), id (le bloc), name (son nom), T (°C), rate (mSv/h), P (bars), fluid (liquide de l'astre ou null) }
export function sampleOf(env) {
  const b = env.body, n = (env.name || '').toLowerCase(), T = env.T ?? b?.temp ?? 15;
  if (!b || b.kind === 'home') return make('home', env, 'hexa');
  const ice = /glace|neige|givre|pergél|banquise/.test(n), salt = /\bsel\b|salin|saumure/.test(n), sulfur = /soufre|sulf/.test(n);
  const wet = /eau|boue|saumure|vase|mer\b/.test(n), methane = /méthane|azote|tholin/.test(n) || (T < -150 && (b.atmo?.density || 0) >= 0.5);
  const lava = /lave|magma|braise/.test(n);
  // (le solvant : l'eau liquide, quelque part entre -30 °C (saumure) et ~120 °C (sous pression) ; ou le méthane)
  if (lava || T > 140) return sterile(env, 'Trop chaud : aucune molécule organique n\'y tient. Rien que des cristaux et des bulles de verre volcanique.');
  if (env.rate > 5 && (wet || ice || T > -60)) return make('radio', env);
  if (sulfur && T > -20) return make('thermo', env);
  if (salt) return make('halo', env);
  if (T > 60 && (wet || (b.atmo?.density || 0) > 0.5)) return make('thermo', env);
  if (methane && T < -140) return make('azoto', env);
  if (ice || (T < 0 && T > -60 && wet)) return make('psychro', env);
  if (wet) return make(T > 40 ? 'thermo' : T < 0 ? 'psychro' : 'meso', env);
  // (un air mince, comme sur Mars : un peu de givre parfois, assez pour des endolithes dans la roche)
  const air = b.atmo?.density || 0;
  if (air > 0.003 && air < 0.3 && T > -120 && T < 60 && !(env.rate > 50)) return make('litho', env);
  if (air <= 0.003) return sterile(env, 'Le vide : pas une goutte de liquide, le rayonnement à nu. Des grains de régolithe, anguleux, jamais polis par l\'eau.');
  if (T < -120) return sterile(env, 'Tout est gelé, rien ne coule : la chimie de la vie s\'arrête. Des grains de glace et de poussière.');
  return sterile(env, 'Trop sec : sans liquide, pas de vie. Des grains minéraux, anguleux, immobiles.');
}
function make(kind, env, epi) {
  const K = KINDS[kind], b = env.body, r = rng(hash((b?.id || 'hexa') + ':' + kind));
  const genus = kind === 'home' ? K.pre[Math.floor(r() * K.pre.length)] : K.pre[Math.floor(r() * K.pre.length)] + K.suf[Math.floor(r() * K.suf.length)];
  const name = genus + ' ' + (epi === 'hexa' ? 'communis' : latin(b?.name || 'ignota'));
  const c = K.colors[Math.floor(r() * K.colors.length)];
  return { key: 'microbe:' + (b?.id || 'hexa') + ':' + kind, kind, name, habitat: K.h, text: K.text, shape: K.shape, color: c, n: 14 + Math.floor(r() * 16), size: K.size, motile: K.motile, seed: hash(name) };
}
const sterile = (env, text) => ({ key: null, kind: 'sterile', name: 'Stérile', habitat: 'aucune vie', text, shape: 'grain', color: '#9a948a', n: 22, size: 1, motile: 0, seed: hash(env.body?.id || 'x') });

// ---------- Sous l'objectif ----------
// (canvas : le champ du microscope ; renvoie une fonction qui arrête l'animation)
export function drawMicroscope(canvas, s) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, R = Math.min(W, H) / 2 - 4, cx = W / 2, cy = H / 2;
  const r = rng(s.seed), cells = [];
  for (let i = 0; i < s.n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.85;
    cells.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, a: r() * Math.PI * 2, k: 0.7 + r() * 0.6, sh: s.shape === 'mix' ? ['bacillus', 'diatom', 'coccus'][i % 3] : s.shape, ph: r() * 6 });
  }
  let raf = 0, last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    const g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
    g.addColorStop(0, '#f4f2e4'); g.addColorStop(1, '#bdb8a0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const c of cells) {
      // (le mouvement brownien : des chocs au hasard ; les flagellées avancent en plus)
      c.x += (Math.random() - 0.5) * 22 * dt + Math.cos(c.a) * s.motile * 30 * dt;
      c.y += (Math.random() - 0.5) * 22 * dt + Math.sin(c.a) * s.motile * 30 * dt;
      c.a += (Math.random() - 0.5) * 2 * dt * (1 + s.motile * 3);
      const dx = c.x - cx, dy = c.y - cy, d = Math.hypot(dx, dy);
      if (d > R * 0.92) { c.x = cx + (dx / d) * R * 0.92; c.y = cy + (dy / d) * R * 0.92; c.a += Math.PI; }
      cell(ctx, c, s, now / 1000);
    }
    ctx.restore();
    // (le tour de l'objectif, la graduation)
    ctx.lineWidth = 6; ctx.strokeStyle = '#1a1c20'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(30, 30, 30, 0.5)';
    ctx.beginPath(); ctx.moveTo(cx - R * 0.5, cy + R * 0.7); ctx.lineTo(cx + R * 0.1, cy + R * 0.7); ctx.stroke();
    ctx.fillStyle = 'rgba(30, 30, 30, 0.7)'; ctx.font = '11px system-ui'; ctx.fillText('10 µm', cx - R * 0.32, cy + R * 0.7 - 4);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
function cell(ctx, c, s, t) {
  const k = c.k * s.size * 7;
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a);
  ctx.fillStyle = s.color; ctx.strokeStyle = 'rgba(20, 20, 20, 0.55)'; ctx.lineWidth = 1;
  const blob = (x, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
  switch (c.sh) {
    case 'lobe': for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; blob(Math.cos(a) * k * 0.35, Math.sin(a) * k * 0.35, k * 0.55, k * 0.55); } break;
    case 'filament': for (let i = 0; i < 6; i++) blob(i * k * 0.9 - k * 2.2, Math.sin(t * 2 + c.ph + i) * k * 0.15, k * 0.5, k * 0.32); break;
    case 'square': ctx.globalAlpha = 0.85; ctx.fillRect(-k, -k, k * 2, k * 2); ctx.strokeRect(-k, -k, k * 2, k * 2); ctx.globalAlpha = 1; break;
    case 'tetrad': for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) blob(x * k * 0.45, y * k * 0.45, k * 0.48, k * 0.48); break;
    case 'vesicle': ctx.globalAlpha = 0.55; blob(0, 0, k, k); ctx.globalAlpha = 1; blob(k * 0.2, -k * 0.1, k * 0.25, k * 0.25); break;
    case 'bacillus': blob(0, 0, k * 0.9, k * 0.35); ctx.beginPath(); ctx.moveTo(-k * 0.9, 0); for (let i = 1; i <= 6; i++) ctx.lineTo(-k * 0.9 - i * k * 0.25, Math.sin(t * 9 + c.ph + i) * k * 0.2); ctx.stroke(); break;
    case 'diatom': ctx.fillStyle = '#e8e0a0'; blob(0, 0, k * 1.2, k * 0.45); ctx.beginPath(); for (let i = -3; i <= 3; i++) { ctx.moveTo(i * k * 0.3, -k * 0.4); ctx.lineTo(i * k * 0.3, k * 0.4); } ctx.stroke(); break;
    case 'grain': ctx.fillStyle = '#8a847a'; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + c.ph; ctx.lineTo(Math.cos(a) * k * (0.6 + ((i * 7 + c.ph * 3) % 4) / 8), Math.sin(a) * k * (0.6 + ((i * 3 + c.ph) % 4) / 8)); } ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    default: blob(0, 0, k * 0.5, k * 0.5);
  }
  ctx.restore();
}
