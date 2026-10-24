// Climat régional : où il pleut, à quelle force, où il y a de l'orage. Comme dans la vraie
// vie, le temps dépend de l'endroit :
//  - de grandes perturbations (quelques milliers de blocs) traversent le monde, poussées
//    par le vent, et se font et se défont en quelques jours : il peut pleuvoir en
//    (5100, 4000) et faire beau en (0, 0) ;
//  - leur forme est étirée et tordue (fronts) : longues bandes de pluie, bords irréguliers ;
//  - au cœur d'une perturbation, la pluie est forte ; au bord, ce n'est qu'une petite pluie,
//    avec des averses isolées (cellules de quelques centaines de blocs, courtes) ;
//  - les orages naissent dans l'air le plus humide, surtout l'après-midi ;
//  - les nuages suivent : ciel dégagé loin de la pluie, couvert dessous.
// Tout vient de la graine et du temps (jours) : même temps pour tous les joueurs. Aucun
// import (ce module sert au jeu, à la carte et aux tests).
// Les calculs se font dans le repère qui suit le vent (ax, az) : un point de ce repère
// garde le même temps (à l'évolution près) en dérivant avec les nuages.

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fade = (t) => t * t * (3 - 2 * t);

function hash(a, b, c, seed) {
  let h = seed ^ Math.imul(a, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) ^ Math.imul(b, 0x165667b1);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) ^ Math.imul(c, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

// Bruit de valeur 3D lissé, dans [0, 1]
function noise3(x, y, z, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = fade(x - x0), fy = fade(y - y0), fz = fade(z - z0);
  const a = hash(x0, y0, z0, seed), b = hash(x0 + 1, y0, z0, seed);
  const c = hash(x0, y0 + 1, z0, seed), d = hash(x0 + 1, y0 + 1, z0, seed);
  const e = hash(x0, y0, z0 + 1, seed), f = hash(x0 + 1, y0, z0 + 1, seed);
  const g = hash(x0, y0 + 1, z0 + 1, seed), h = hash(x0 + 1, y0 + 1, z0 + 1, seed);
  const ab = a + (b - a) * fx, cd = c + (d - c) * fx, ef = e + (f - e) * fx, gh = g + (h - g) * fx;
  const lo = ab + (cd - ab) * fy, hi = ef + (gh - ef) * fy;
  return lo + (hi - lo) * fz;
}

// Un jour de jeu dure 30 minutes (voir sky.js), mais la météo garde son rythme : les durées
// ci-dessous sont données en "jours de 10 minutes" (W) et converties en jours de jeu.
export const DAY_SCALE = 3;
const W = 1 / DAY_SCALE;
// Tailles (blocs) et durées de vie (jours)
const SYN = 3000, SYN_LIFE = 3 * W;      // perturbations
const SYN2 = 1150, SYN2_LIFE = 1.3 * W;  // leurs détails
const WARP = 1900, WARP_AMP = 1500;      // torsion (fronts)
const CELL = 280, CELL_LIFE = 0.3 * W;   // averses
const STORM = 650, STORM_LIFE = 0.5 * W; // zones d'orage
// Seuils d'humidité (calibrés : pluie sur ~18 % du monde, forte pluie ~4 %, orage ~1 %)
const RAIN_LO = 0.58, RAIN_HI = 0.82;
const DESERT_DRY = 0.09;             // un désert est plus sec (pluie rare)
// Tornades : au plus une par case de TOR_CELL blocs (repère du vent) et par tranche de
// TOR_SLOT jour, avec la probabilité TOR_CHANCE, si elle tombe dans un orage assez fort.
// Vie : TOR_LIFE à TOR_LIFE + TOR_LIFE_VAR jour (un jour = 10 min) ; vitesse : TOR_SPEED
// blocs par jour en plus du vent.
const TOR_CELL = 1200, TOR_SLOT = 0.25 * W, TOR_CHANCE = 0.6, TOR_STORM = 0.35;
const TOR_LIFE = 0.1 * W, TOR_LIFE_VAR = 0.12 * W, TOR_SPEED = 1500 / W;
const TOR_TRAVEL = TOR_SPEED * (TOR_LIFE + TOR_LIFE_VAR) + 30;
// Centres de pression ajoutés par /weather : une dépression (niveau > 0) rend l'air plus
// humide autour d'elle (nuages, pluie, orages, tornades aux niveaux forts), un anticyclone
// (niveau < 0) l'assèche (ciel dégagé). Ils naissent à l'endroit du joueur, dérivent avec le
// vent, se creusent peu à peu (PRESS_GROW), durent PRESS_LIFE jours puis se comblent.
export const PRESS_MAX = 5;
const PRESS_R = 1400;          // rayon d'influence (blocs)
// Près du centre, l'humidité est tirée vers celle que veut le niveau (PRESS_PULL au plus) :
// le résultat ne dépend presque plus du temps qu'il faisait avant.
//   1 : nuageux, petite pluie   2 : pluie   3 : forte pluie   4 : orages   5 : orages violents
//   -1 à -5 : de moins en moins de nuages
const PRESS_PULL = 0.92;
const pressHumidity = (level) => (level > 0 ? 0.6 + 0.052 * level : 0.44 + 0.04 * level);
// /weather tornade : centre de niveau max formé en TOR_GROW jour, orage forcé, et une
// tornade qui naît TOR_DELAY jour plus tard à TOR_START blocs et fonce vers le centre
const TOR_GROW = 0.015 * W, TOR_DELAY = 0.025 * W, TOR_START = 110, TOR_FORCED_LIFE = 0.25 * W;
const PRESS_STORM = 0.1;      // zone d'orage renforcée par niveau au-delà de 2
const PRESS_GROW = 0.06 * W, PRESS_LIFE = 1.5 * W, PRESS_FADE = 0.3 * W; // (2 min, 15 min, 3 min)

export class Climate {
  // seed : entier ; wind : direction {x, y} du vent ; drift : blocs parcourus par jour
  constructor(seed, wind, drift) {
    this.seed = seed ^ 0x5eed7;
    this.wx = wind.x; this.wy = wind.y;
    this.drift = drift;
    this.tmp = {};
    this.pressures = []; // centres de pression : { x, z (repère du vent), t0, level }
    this.press = { w: 0, level: 0, tor: 0 };
  }

  // Point du monde -> repère du vent, au temps T
  toAdv(x, z, T) {
    const d = T * this.drift;
    return [x - this.wx * d, z - this.wy * d];
  }

  // Humidité de l'air (0..1, autour de 0,5) au point (ax, az) du repère du vent
  // Ajoute un centre de pression au point (x, z) du monde, au temps T
  // tornado : /weather tornade (tempête très rapide et une tornade qui arrive, voir TOR_*)
  addPressure(x, z, T, level, tornado = false) {
    const [ax, az] = this.toAdv(x, z, T);
    this.prune(T);
    const p = { x: Math.round(ax), z: Math.round(az), t0: T, level };
    if (tornado) p.tor = Math.round(Math.random() * 628) / 100; // (direction d'où elle vient)
    this.pressures.push(p);
  }

  // Retire les centres de pression finis
  prune(T) {
    this.pressures = this.pressures.filter((p) => T < p.t0 + PRESS_LIFE);
  }

  // Liste reçue (partie en ligne, sauvegarde) : seulement des valeurs valides
  setPressures(list) {
    this.pressures = (Array.isArray(list) ? list : []).filter((p) => p && [p.x, p.z, p.t0, p.level].every(Number.isFinite))
      .slice(0, 32).map((p) => {
        const q = { x: p.x, z: p.z, t0: p.t0, level: Math.max(-PRESS_MAX, Math.min(PRESS_MAX, p.level)) };
        if (Number.isFinite(p.tor)) q.tor = p.tor;
        return q;
      });
  }

  // Effet des centres de pression en (ax, az) au temps T : out.w = poids (0 loin de tous,
  // 1 au centre une fois formé), out.level = niveau ressenti (négatif : anticyclone).
  // Rend le niveau ressenti.
  pressureAt(ax, az, T, out = this.press) {
    let w = 0, lw = 0, tor = 0;
    for (const p of this.pressures) {
      const age = T - p.t0;
      if (age < 0 || age > PRESS_LIFE) continue;
      const d2 = ((ax - p.x) ** 2 + (az - p.z) ** 2) / (PRESS_R * PRESS_R);
      if (d2 > 4) continue;
      // il se creuse peu à peu (très vite pour /weather tornade), puis se comble à la fin
      const k = smooth(0, p.tor !== undefined ? TOR_GROW : PRESS_GROW, age) * (1 - smooth(PRESS_LIFE - PRESS_FADE, PRESS_LIFE, age)) * Math.exp(-d2 * 1.6);
      w += k;
      lw += p.level * k;
      if (p.tor !== undefined) tor = Math.max(tor, k);
    }
    out.w = Math.min(1, w);
    out.tor = tor;
    out.level = w > 0 ? lw / w * Math.min(1, w) : 0;
    return out.level;
  }

  humidityAdv(ax, az, T) {
    const s = this.seed;
    // torsion : les perturbations s'étirent en bandes courbes
    const wx = (noise3(ax / WARP, az / WARP, T / SYN_LIFE, s ^ 0x1111) - 0.5) * WARP_AMP;
    const wz = (noise3(ax / WARP + 31.7, az / WARP - 12.3, T / SYN_LIFE, s ^ 0x2222) - 0.5) * WARP_AMP;
    const px = ax + wx, pz = az + wz;
    const hum = noise3(px / SYN, pz / SYN, T / SYN_LIFE, s) * 0.68
      + noise3(px / SYN2, pz / SYN2, T / SYN2_LIFE, s ^ 0x3333) * 0.32;
    if (!this.pressures.length) return hum;
    // centres de pression : l'humidité va vers celle de leur niveau
    const pr = this.pressureAt(ax, az, T);
    if (this.press.w <= 0) return hum;
    const target = pressHumidity(pr / this.press.w);
    return hum + (target - hum) * this.press.w * PRESS_PULL;
  }

  // Temps au point (x, z) du monde, au temps T. dry : sécheresse du sol (désert : 1).
  // Rend { cover, rain, storm } : couverture du ciel, force de la pluie, orage (0..1).
  at(x, z, T, dry = 0, out = {}) {
    const [ax, az] = this.toAdv(x, z, T);
    return this.atAdv(ax, az, T, dry, out);
  }

  atAdv(ax, az, T, dry = 0, out = {}) {
    const s = this.seed;
    const hum = this.humidityAdv(ax, az, T) - dry * DESERT_DRY;
    // averses : de petites cellules qui renforcent ou coupent la pluie, surtout au bord
    // des perturbations (au cœur, il pleut partout)
    const cell = noise3(ax / CELL, az / CELL, T / CELL_LIFE, s ^ 0x4444) - 0.5;
    const edge = 1 - smooth(RAIN_HI, RAIN_HI + 0.06, hum);
    const wet = hum + cell * 0.11 * edge;
    // (surtout de la petite pluie : les cœurs de forte pluie sont petits, comme au radar)
    out.rain = smooth(RAIN_LO, RAIN_HI, wet) ** 1.7;
    // orage : dans l'air le plus humide, là où la zone d'orage est active ; plus
    // fréquent l'après-midi (vers 16 h) que la nuit
    const t = T - Math.floor(T);
    const day = 0.75 + 0.35 * Math.cos((t - 0.42) * Math.PI * 2);
    const st = noise3(ax / STORM, az / STORM, T / STORM_LIFE, s ^ 0x5555)
      + (this.pressures.length ? Math.max(0, this.pressureAt(ax, az, T) - 2) * PRESS_STORM + this.press.tor * 0.35 : 0);
    out.storm = smooth(0.68, 0.76, wet) * smooth(0.52, 0.66, st * day) * (1 - dry * 0.7);
    // nuages : quelques-uns par beau temps, couvert sous la pluie
    out.cover = Math.min(1, Math.max(0.03, (hum - 0.38) * 3.4));
    return out;
  }

  // Tornades actives à moins de R blocs de (x, z) au temps T. Chacune naît dans un orage
  // fort (en un point et un moment tirés de la graine), descend du nuage, avance quelques
  // minutes (poussée par le vent, avec sa propre trajectoire un peu sinueuse) puis remonte.
  // Rend [{ id, x, z, f, power }] : f = avancée de sa vie (0..1), power = force (0..1,
  // nulle quand elle naît ou s'éteint).
  tornadoesNear(x, z, T, R, out = []) {
    out.length = 0;
    const s = this.seed ^ 0x70e4, d = T * this.drift;
    const ax = x - this.wx * d, az = z - this.wy * d, reach = R + TOR_TRAVEL;
    const i0 = Math.floor((ax - reach) / TOR_CELL), i1 = Math.floor((ax + reach) / TOR_CELL);
    const j0 = Math.floor((az - reach) / TOR_CELL), j1 = Math.floor((az + reach) / TOR_CELL);
    const k0 = Math.floor((T - TOR_LIFE - TOR_LIFE_VAR) / TOR_SLOT), k1 = Math.floor(T / TOR_SLOT);
    for (let k = k0; k <= k1; k++) {
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          if (hash(i, j, k, s) >= TOR_CHANCE) continue;
          const t0 = (k + hash(i, j, k, s ^ 1)) * TOR_SLOT, life = TOR_LIFE + TOR_LIFE_VAR * hash(i, j, k, s ^ 2);
          const age = T - t0;
          if (age < 0 || age > life) continue;
          const bx = (i + hash(i, j, k, s ^ 3)) * TOR_CELL, bz = (j + hash(i, j, k, s ^ 4)) * TOR_CELL;
          // seulement dans un orage fort (là où elle naît, quand elle naît)
          if (this.atAdv(bx, bz, t0, 0, this.tmp).storm < TOR_STORM) continue;
          const head = hash(i, j, k, s ^ 5) * Math.PI * 2, dist = TOR_SPEED * age;
          const wob = Math.sin(age * 90 + head * 3) * 25; // (chemin sinueux)
          const px = bx + Math.cos(head) * dist - Math.sin(head) * wob + this.wx * d;
          const pz = bz + Math.sin(head) * dist + Math.cos(head) * wob + this.wy * d;
          if ((px - x) ** 2 + (pz - z) ** 2 > R * R) continue;
          const f = age / life;
          out.push({ id: i + ',' + j + ',' + k, x: px, z: pz, f, power: smooth(0, 0.12, f) * (1 - smooth(0.85, 1, f)) });
        }
      }
    }
    // tornades de /weather tornade : elle naît à TOR_START blocs du centre et fonce vers lui
    for (const p of this.pressures) {
      if (p.tor === undefined) continue;
      const t0 = p.t0 + TOR_DELAY, age = T - t0;
      if (age < 0 || age > TOR_FORCED_LIFE) continue;
      const head = p.tor + Math.PI, dist = TOR_SPEED * age, wob = Math.sin(age * 90 + p.tor * 3) * 25;
      const bx = p.x + Math.cos(p.tor) * TOR_START, bz = p.z + Math.sin(p.tor) * TOR_START;
      const px = bx + Math.cos(head) * dist - Math.sin(head) * wob + this.wx * d;
      const pz = bz + Math.sin(head) * dist + Math.cos(head) * wob + this.wy * d;
      if ((px - x) ** 2 + (pz - z) ** 2 > R * R) continue;
      const f = age / TOR_FORCED_LIFE;
      out.push({ id: 'w' + p.t0, x: px, z: pz, f, power: smooth(0, 0.08, f) * (1 - smooth(0.85, 1, f)) });
    }
    return out;
  }

  // Couverture seule (pour chaque hexagone de nuage : moins de calculs)
  coverAdv(ax, az, T) {
    return Math.min(1, Math.max(0.03, (this.humidityAdv(ax, az, T) - 0.38) * 3.4));
  }
}
