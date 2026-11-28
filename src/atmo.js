// L'air des astres, et ce qu'il fait à ce qui le traverse : rentrée atmosphérique, parachutes,
// aérofreins, ballons, intérieur des géantes gazeuses (voir rocket.js, spaceflight.js, main.js).
//
// Les lois suivies (à l'échelle du jeu : g = 30 blocs/s² sur Hexa, l'air de densité 1,2 × 30 / 9,81
// pour que les vitesses limites restent celles du monde réel, voir rocket.js) :
//  - planètes solides : densité et pression en exponentielle (hauteur d'échelle 120 blocs),
//    température qui baisse en montant (0,46 °C par bloc, jusqu'à la tropopause, 75 °C plus froide) ;
//  - géantes gazeuses et de glace : le niveau 1 bar est leur surface visible (leur rayon R).
//    Au-dessus, une exponentielle ; en dessous, un gaz adiabatique (polytrope, P ∝ T^3,5 : de
//    l'hydrogène et de l'hélium). Les couches de nuages sont là où leur gaz se condense, comme sur
//    Jupiter : ammoniac (~0,7 bar), hydrosulfure d'ammonium (~2 bar), eau (~5 bar, les orages),
//    puis l'hydrogène de plus en plus dense et chaud, et l'hydrogène métallique (~2 millions de bars) ;
//  - traînée : F = ½ ρ v² Cd A (sur la vitesse par rapport à l'air, vent compris) ;
//  - échauffement : la température d'arrêt T0 = T + v² / (2 cp), le flux de Sutton-Graves au nez
//    q = 1,74e-4 √(ρ / rn) v³ ; la coque tend vers l'équilibre entre ce flux et ce qu'elle rayonne
//    (εσT⁴), sans jamais dépasser T0. Au-delà de la fusion de sa matière, un bloc exposé fond ; le
//    bouclier thermique, lui, s'use (ablation) et protège ce qui est derrière lui ;
//  - poussée d'Archimède (ballons à hydrogène chauffé) : ρ V (1 - T / Tint) g.
import * as THREE from 'three';
import { NEIGHBORS, hexToWorld } from './hex.js?v=1.1.0-mx09tneh';
import { BLOCKS } from './blocks.js?v=1.1.0-mx09tneh';

export const G_SCALE = 30 / 9.81;
export const RHO_SEA = 1.2 * G_SCALE;  // (densité de l'air d'Hexa au niveau de la mer, comme rocket.js)
export const H_AIR = 120;              // hauteur d'échelle d'une planète solide (blocs)
const LAPSE = 0.46, TROPO = 75;        // (°C par bloc, et la tropopause)
export const GH_UP = 138, GH_POLY = 483;      // géantes : hauteur d'échelle au-dessus de 1 bar ; profondeur de la polytrope
const RHO_H2 = 0.168 * G_SCALE;        // (hydrogène et hélium à 1 bar, 165 K)
const CP = 1005, SIGMA = 5.67e-8, EPS = 0.8;
const SPACE_T = 270;                   // (une coque au soleil, dans le vide)
export const KELVIN = 273.15;

// Parachutes (ouverts en deux temps : rifés, puis entiers), aérofreins, ballons
export const CHUTE_A = 1000, CHUTE_CD = 1.5, CHUTE_REEF = 0.06; // (m² : un dôme de 36 m ; rifé : 6 % de sa surface)
export const CHUTE_Q_FULL = 6000, CHUTE_Q_TEAR = 60000;          // (Pa : s'ouvre en entier en dessous ; se déchire, rifé, au-dessus)
const CHUTE_OPEN = 2.5;                                          // (s : le temps de se gonfler)
export const BRAKE_A = 6, BRAKE_CD = 1.2, BRAKE_Q_TEAR = 250000;
export const BALLOON_V = 2000, BALLOON_DT = 100;                 // (m³ ; son gaz chauffé de 100 °C de plus que l'air)
const ABLATE = 6e8;                                              // (J/m² que le bouclier absorbe avant de s'user d'un bloc)
// (coques : la pression qu'elles tiennent, en bars ; au-delà du double, écrasées)
export const HULL_P = 200, SUIT_P = 6;

const giantKind = (b) => !b.land && !b.molten && b.kind !== 'star' && b.kind !== 'hole';
export const isGiant = (b) => !!b && giantKind(b) && (b.atmo?.density || 0) > 0;

// Les couches d'une géante (de haut en bas, par pression en bars) : nom, couleur du brouillard,
// visibilité (blocs), orages
const LAYERS = [
  { p: 0.45, name: 'la haute atmosphère', color: 0x8a90a8, see: 4000 },
  { p: 1.4, name: "les nuages d'ammoniac", color: 0xe8dcc0, see: 260 },
  { p: 3, name: "les nuages d'hydrosulfure d'ammonium", color: 0xb87848, see: 160 },
  { p: 9, name: "les nuages d'eau (orages)", color: 0x8a96a8, see: 120, storm: true },
  { p: 2e3, name: "les profondeurs d'hydrogène", color: 0x5a3020, see: 90 },
  { p: 2e6, name: "l'hydrogène liquide", color: 0x401008, see: 50 },
  { p: Infinity, name: "l'hydrogène métallique", color: 0x9a8070, see: 30, metal: true },
];
export const layerAt = (P) => LAYERS.find((l) => P < l.p);

// L'air d'un astre à une altitude (au-dessus du sol pour une planète solide, du niveau 1 bar pour
// une géante). out : { rho (kg/m³, échelle du jeu), P (bar), T (K), layer (géantes), giant }
export function airOfBody(b, alt, out = {}) {
  const d = b?.atmo?.density || 0;
  out.giant = false; out.layer = null;
  if (!d) { out.rho = 0; out.P = 0; out.T = SPACE_T; return out; }
  if (giantKind(b)) {
    const T1 = (b.temp ?? -110) + KELVIN;
    if (alt >= 0) { out.P = d / 3 * Math.exp(-alt / GH_UP); out.T = Math.max(T1 * 0.67, T1 - alt * 0.17); }
    else { const k = 1 - alt / GH_POLY; out.P = d / 3 * k ** 3.5; out.T = T1 * k; }
    out.rho = RHO_H2 * out.P * (165 / out.T);
    out.giant = true; out.layer = layerAt(out.P);
    return out;
  }
  const T0 = (b.temp ?? 15) + KELVIN, e = Math.exp(-alt / H_AIR);
  out.P = d * e; out.T = Math.max(T0 - TROPO, T0 - Math.max(0, alt) * LAPSE);
  out.rho = RHO_SEA * d * e; // (la même exponentielle que rocket.airAt)
  return out;
}

// Température de fusion (K) d'un bloc exposé au flux
export function meltT(id) {
  const B = BLOCKS[id];
  if (!B) return 1700;
  if (B.heatShield) return 3300;
  if (B.thrust || B.reactor) return 2100; // (tuyères : alliages réfractaires)
  const n = (B.name || '').toLowerCase();
  if (/tungst/.test(n)) return 3600;
  if (/céram|brique|basalte|obsidienne/.test(n)) return 1900;
  if (/alumin/.test(n)) return 930;
  if (/verre|vitre|hublot/.test(n)) return 1400;
  if (/bois|planche|laine|toile|feuill|paille|tapis|lit|parachute|ballon/.test(n)) return 560;
  if (/glace|neige/.test(n)) return 273;
  return 1700; // (acier, roche)
}

// directions des 8 voisins d'une case, dans la grille locale : [dq, dr, dy, vecteur unité]
const DIRS = [...NEIGHBORS.map(([q, r]) => { const w = hexToWorld(q, r); return [q, r, 0, new THREE.Vector3(w.x, 0, w.z).normalize()]; }), [0, 0, 1, new THREE.Vector3(0, 1, 0)], [0, 0, -1, new THREE.Vector3(0, -1, 0)]];
const key = (q, r, y) => q + ',' + r + ',' + y;
const _v = new THREE.Vector3(), _u = new THREE.Vector3(), _q = new THREE.Quaternion(), _w = new THREE.Vector3();

// Ce qui, dans une fusée, se sert de l'air (voir rocket.scan) : parachutes, aérofreins, ballons, boucliers
export function scanAero(s) {
  const A = { chutes: [], brakes: 0, balloons: [], shields: 0 };
  for (const [k, id] of s.blocks) {
    const B = BLOCKS[id];
    if (!B) continue;
    if (B.chute) A.chutes.push(k);
    else if (B.airbrake) A.brakes++;
    else if (B.balloon) A.balloons.push(k);
    else if (B.heatShield) A.shields++;
  }
  return A;
}

// Les blocs face au vent : ceux dont le voisin vers l'avant (dans le sens de la vitesse) est vide.
// (gardés tant que la fusée ne change pas et que le vent garde à peu près sa direction)
function exposed(s, vl) {
  const tag = s.blocks.size + ':' + Math.round(vl.x * 3) + ',' + Math.round(vl.y * 3) + ',' + Math.round(vl.z * 3);
  if (s.aeroExp?.tag === tag) return s.aeroExp.list;
  const fwd = DIRS.filter((d) => d[3].dot(vl) > 0.3), list = [];
  for (const [k, id] of s.blocks) {
    const [q, r, y] = k.split(',').map(Number);
    if (fwd.some(([dq, dr, dy]) => !s.blocks.has(key(q + dq, r + dr, y + dy)))) list.push([k, id]);
  }
  s.aeroExp = { tag, list };
  return list;
}

// Un pas d'air pour une fusée (voir rocket.force) : traînée, parachutes, aérofreins, ballons,
// échauffement de la coque et fonte des blocs exposés. air : { rho, P, T, vair, up, g } (vair : la
// vitesse de l'air, up : le haut de l'astre, dans le repère où est s.vel). Renvoie les blocs fondus.
export function aeroStep(s, h, air, st, opt = {}) {
  const R = s.rocket, A = R?.aero;
  const st0 = s.aeroSt || (s.aeroSt = { skin: air.rho > 0 ? air.T : SPACE_T, chute: 0, open: 0, brake: false, balloon: false, wear: new Map(), q: 0, T0: air.T, melt: 0, torn: 0, clock: 0 });
  const S = st0;
  const vr = _v.copy(s.vel).sub(air.vair || _w.set(0, 0, 0)), v = vr.length();
  // (d'où vient l'air, dans la grille de la fusée : pour savoir quels blocs y font face)
  const vl = v > 1e-3 ? _u.copy(vr).divideScalar(v).applyQuaternion(_q.copy(s.quat).invert()) : _u.set(0, -1, 0);
  S.vl = S.vl || new THREE.Vector3(); S.vl.copy(vl);
  // (et dans le monde : vers où l'on file dans l'air, pour l'enveloppe de plasma et les parachutes)
  S.dir = S.dir || new THREE.Vector3(); if (v > 1e-3) S.dir.copy(vr).divideScalar(v);
  const qd = 0.5 * air.rho * v * v;   // pression dynamique (Pa, échelle du jeu)
  S.q = qd; S.v = v;
  // traînée : la coque, puis ce qui est déployé
  let CdA = CD_HULL * Math.pow(s.list.length, 2 / 3) * 0.866;
  if (A && air.rho > 0) {
    // parachutes : rifés d'abord, entiers quand l'air a assez freiné ; déchirés si c'est trop fort
    if (S.chute && A.chutes.length) {
      S.open = Math.min(1, S.open + h / CHUTE_OPEN);
      if (S.chute === 1 && qd < CHUTE_Q_FULL && S.open >= 1) { S.chute = 2; S.open = 0.3; }
      const tear = S.chute === 1 ? CHUTE_Q_TEAR : CHUTE_Q_FULL * 2.2;
      if (qd * S.open > tear) { S.torn = A.chutes.length; S.chute = 0; S.open = 0; if (opt.onTear) opt.onTear(s, A.chutes.slice()); }
      else CdA += A.chutes.length * CHUTE_CD * CHUTE_A * (S.chute === 1 ? CHUTE_REEF : 1) * S.open;
    }
    if (S.brake && A.brakes) {
      if (qd > BRAKE_Q_TEAR) { S.brake = false; if (opt.onBrakeFail) opt.onBrakeFail(s); }
      else CdA += A.brakes * BRAKE_CD * BRAKE_A;
    }
  }
  if (air.rho > 0 && v > 0.01) {
    // (implicite : stable même quand la traînée est énorme, parachute ouvert)
    const k = (0.5 * air.rho * CdA * v * h) / s.mass;
    vr.multiplyScalar(1 / (1 + k) - 1);
    s.vel.add(vr);
    s.ang.multiplyScalar(1 / (1 + air.rho * 0.05 * h));
  }
  // ballons : la poussée d'Archimède, vers le haut de l'astre
  if (A?.balloons.length && S.balloon && air.rho > 0 && air.up) {
    const lift = air.rho * BALLOON_V * (1 - air.T / (air.T + BALLOON_DT)) * air.g * A.balloons.length;
    s.vel.addScaledVector(air.up, (lift / s.mass) * h);
  }
  // échauffement : la coque tend vers l'équilibre (flux reçu = flux rayonné), sans dépasser T0
  const T0 = air.T + (v * v) / (2 * CP);
  const rn = Math.max(0.5, s.radius * 0.6);
  const flux = air.rho > 0 ? 1.74e-4 * Math.sqrt(air.rho / G_SCALE / rn) * v * v * v : 0;
  const Teq = air.rho > 0 ? Math.max(air.T, Math.min(T0, Math.pow(flux / (EPS * SIGMA) + air.T ** 4, 0.25))) : SPACE_T;
  S.skin += (Teq - S.skin) * (1 - Math.exp(-h / (air.rho > 0 ? 5 : 40)));
  S.T0 = air.rho > 0 ? T0 : SPACE_T; S.flux = flux;
  // fonte et ablation des blocs face au vent (4 fois par seconde)
  S.clock += h;
  let gone = null;
  if (S.clock >= 0.25) {
    const dt = S.clock; S.clock = 0;
    if (S.skin > 520 && v > 1 && !st.noDamage) {
      for (const [k, id] of exposed(s, S.vl)) {
        const B = BLOCKS[id];
        let w = 0;
        if (B?.heatShield) { if (S.skin > 1300) w = (flux * dt) / ABLATE; }
        const m = meltT(id);
        if (S.skin > m) w += ((S.skin - m) / m) * 2 * dt;
        if (w <= 0 || B?.unbreakable) continue;
        const t = (S.wear.get(k) || 0) + w;
        if (t >= 1) { S.wear.delete(k); (gone || (gone = [])).push(k); } else S.wear.set(k, t);
      }
    }
  }
  return gone;
}
const CD_HULL = 0.6;

// ---------- Les effets (selon les réglages, voir main.js : options.entryFx, giantFog, lightning) ----------
const SHEATH_VS = `varying vec3 vN; varying vec3 vV; varying float vZ;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vZ = position.z; gl_Position = projectionMatrix * mv; }`;
const SHEATH_FS = `uniform vec3 uC; uniform float uI; uniform float uT; varying vec3 vN; varying vec3 vV; varying float vZ;
void main() {
  float f = pow(1.0 - abs(dot(vN, vV)), 1.6);
  float tail = smoothstep(-1.0, 0.2, vZ) * (1.0 - smoothstep(0.6, 1.0, vZ));
  float flick = 0.8 + 0.2 * sin(uT * 37.0 + vZ * 9.0);
  gl_FragColor = vec4(uC * f * (0.4 + tail) * uI * flick, 1.0);
}`;
export class EntryFx {
  constructor(scene) {
    this.scene = scene;
    this.level = 2; this.fog = true; this.storms = true;
    this.sheaths = new Map();   // fusée -> enveloppe de plasma
    this.canopies = new Map();  // fusée -> groupe (dômes et suspentes)
    this.geo = new THREE.SphereGeometry(1, 28, 18);
    this.dome = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    // (dôme rayé orange et blanc)
    const c = [], p = this.dome.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), w = Math.floor((a / Math.PI + 1) * 6) % 2; c.push(...(w ? [1, 0.45, 0.1] : [0.95, 0.93, 0.88])); }
    this.dome.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    this.domeMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.envMat = new THREE.MeshLambertMaterial({ color: 0xb0302a, emissive: 0x401008 });
    this.lineMat = new THREE.LineBasicMaterial({ color: 0xd8d4c8 });
    // l'écran : une lueur rouge sur les bords, le flash des éclairs
    this.el = document.createElement('div');
    this.el.id = 'entry-fx';
    this.el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;background:radial-gradient(ellipse at center, rgba(255,120,40,0) 35%, rgba(255,90,30,0.55) 75%, rgba(255,40,10,0.9) 100%)';
    this.flashEl = document.createElement('div');
    this.flashEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;background:#e8f0ff';
    document.body.append(this.el, this.flashEl);
    // l'intérieur d'une géante : une sphère de brouillard autour de la caméra (le fond), et les éclairs
    this.murk = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: 0, side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false, fog: false }));
    this.murk.renderOrder = 1e6; // (dessinée avec le ciel, par-dessus lui : voir main.js) this.murk.frustumCulled = false; this.murk.visible = false;
    scene.add(this.murk);
    this.bolt = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xf0f4ff, fog: false }));
    this.bolt.frustumCulled = false; this.bolt.visible = false;
    scene.add(this.bolt);
    this.flash = 0; this.boltT = 0; this.nextBolt = 3; this.t = 0;
    this.shake = 0;
  }
  sheath(s) {
    let m = this.sheaths.get(s);
    if (!m) {
      m = new THREE.Mesh(this.geo, new THREE.ShaderMaterial({ vertexShader: SHEATH_VS, fragmentShader: SHEATH_FS, uniforms: { uC: { value: new THREE.Color() }, uI: { value: 0 }, uT: { value: 0 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.frustumCulled = false;
      this.scene.add(m); this.sheaths.set(s, m);
    }
    return m;
  }
  drop(s) {
    const m = this.sheaths.get(s); if (m) { this.scene.remove(m); m.material.dispose(); this.sheaths.delete(s); }
    const g = this.canopies.get(s); if (g) { this.scene.remove(g); g.traverse((o) => { if (o.isLine) o.geometry.dispose(); }); this.canopies.delete(s); }
  }
  // À chaque image : list = les fusées (avec s.aeroSt), toWorld(s, k, out) : la place d'un bloc ;
  // me : la fusée où est le joueur (ou { aeroSt } pour lui seul) ; up(s) : le haut de l'astre
  update(dt, list, toWorld, me, up) {
    this.t += dt;
    for (const s of [...this.sheaths.keys()]) if (!list.includes(s)) this.drop(s);
    for (const s of [...this.canopies.keys()]) if (!list.includes(s)) this.drop(s);
    for (const s of list) {
      const S = s.aeroSt;
      if (!S) continue;
      // plasma : l'onde de choc brille dès que l'air arrêté dépasse ~1 500 K, et file derrière
      const I = this.level >= 2 ? Math.max(0, Math.min(1, (S.T0 - 1500) / 4000)) : 0;
      if (I > 0.01 && S.v > 1) {
        const m = this.sheath(s), r = s.radius * 1.15;
        _v.copy(S.dir);
        m.quaternion.setFromUnitVectors(_u.set(0, 0, -1), _v);
        m.scale.set(r, r, r * (1.2 + 2.5 * I));
        m.position.copy(s.pos).addScaledVector(_v, -r * 1.6 * I);
        // (orange vers 2 000 K, rose et violet au-delà : l'air ionisé)
        m.material.uniforms.uC.value.setRGB(1, 0.45 + 0.1 * I, 0.15 + 0.6 * I * I);
        m.material.uniforms.uI.value = I * 1.4; m.material.uniforms.uT.value = this.t;
        m.visible = true;
      } else { const m = this.sheaths.get(s); if (m) m.visible = false; }
      // parachutes ouverts, ballons gonflés
      const A = s.rocket?.aero, want = A && ((S.chute && A.chutes.length) || (S.balloon && A.balloons.length));
      let g = this.canopies.get(s);
      if (!want) { if (g) g.visible = false; continue; }
      if (!g) { g = new THREE.Group(); this.scene.add(g); this.canopies.set(s, g); }
      g.visible = true;
      const items = [...(S.chute ? A.chutes.slice(0, 6).map((k) => [k, 0]) : []), ...(S.balloon ? A.balloons.slice(0, 6).map((k) => [k, 1]) : [])];
      while (g.children.length < items.length * 2) {
        const i = g.children.length / 2, bal = items[i]?.[1];
        g.add(new THREE.Mesh(bal ? this.geo : this.dome, bal ? this.envMat : this.domeMat));
        const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(8 * 6), 3));
        g.add(new THREE.LineSegments(lg, this.lineMat));
      }
      for (let i = 0; i < g.children.length / 2; i++) {
        const dome = g.children[i * 2], lines = g.children[i * 2 + 1], it = items[i];
        dome.visible = lines.visible = !!it;
        if (!it) continue;
        const [k, bal] = it, at = toWorld(s, k, _w);
        // un parachute traîne derrière (contre la vitesse) ; un ballon monte vers le haut de l'astre
        const dir = bal ? up(s, _v) : (S.v > 0.5 ? _v.copy(S.dir).negate() : _v.set(0, 1, 0));
        const rad = bal ? Math.cbrt((3 * BALLOON_V) / (4 * Math.PI)) : Math.sqrt((CHUTE_A * (S.chute === 1 ? CHUTE_REEF : 1)) / Math.PI) * Math.max(0.15, S.open);
        const dist = rad * (bal ? 1.1 : 1.5) + 3;
        dome.position.copy(at).addScaledVector(dir, dist);
        dome.quaternion.setFromUnitVectors(_u.set(0, 1, 0), dir);
        dome.scale.set(rad, bal ? rad * 1.25 : rad * 0.7, rad);
        // suspentes : du bloc au bord du dôme
        const P = lines.geometry.attributes.position;
        for (let j = 0; j < 8; j++) {
          const a = (j / 8) * Math.PI * 2;
          _u.set(Math.cos(a) * rad, 0, Math.sin(a) * rad).applyQuaternion(dome.quaternion).add(dome.position);
          if (bal) _u.addScaledVector(dir, -rad * 0.9);
          P.setXYZ(j * 2, at.x, at.y, at.z); P.setXYZ(j * 2 + 1, _u.x, _u.y, _u.z);
        }
        P.needsUpdate = true;
        lines.geometry.computeBoundingSphere();
      }
    }
    // l'écran (le joueur à bord, ou seul) : rougeoie avec la coque, tremble avec la pression de l'air
    const M = me?.aeroSt;
    const glow = this.level >= 1 && M ? Math.max(0, Math.min(1, (M.skin - 700) / 1500)) * 0.7 + Math.max(0, Math.min(1, (M.T0 - 1500) / 4000)) * 0.5 : 0;
    this.el.style.opacity = glow > 0.01 ? Math.min(1, glow).toFixed(3) : '0';
    this.shake = this.level >= 2 && M ? Math.min(1, (M.q || 0) / 60000) : 0;
    // les éclairs
    this.flash = Math.max(0, this.flash - dt * 6);
    this.flashEl.style.opacity = this.flash > 0.01 ? (this.flash * 0.6).toFixed(3) : '0';
    if ((this.boltT -= dt) <= 0) this.bolt.visible = false;
  }
  // l'intérieur d'une géante (air : celui de la caméra ; null dehors). Renvoie la visibilité (blocs) pour le brouillard
  giant(dt, air, camPos, rand = Math.random) {
    const L = air?.giant && air.P > 0.3 ? air.layer : null;
    if (!L || !this.fog) { this.murk.visible = false; return null; }
    const k = Math.max(0, Math.min(1, (air.P - 0.3) / 0.9)); // (de plus en plus épais en descendant sous les nuages)
    this.murk.visible = true;
    this.murk.position.copy(camPos);
    this.murk.scale.setScalar(Math.min(L.see * 1.6, 5000));
    // (plus sombre en profondeur : la lumière de l'étoile n'arrive plus ; rougeoie au fond, très chaud)
    const dark = Math.max(0.08, Math.min(1, 1.2 - Math.log10(Math.max(1, air.P)) * 0.35)), heat = Math.max(0, Math.min(1, (air.T - 900) / 2500));
    this.murk.material.color.setHex(L.color).multiplyScalar(dark).lerp(_c1.setRGB(1, 0.35, 0.08), heat * 0.6);
    this.murk.material.opacity = k;
    // orages : dans les nuages d'eau
    if (L.storm && this.storms && (this.nextBolt -= dt) <= 0) {
      this.nextBolt = 1.5 + rand() * 6;
      this.flash = 0.6 + rand() * 0.4;
      const a = rand() * Math.PI * 2, d = 120 + rand() * 500, pts = [];
      const x = camPos.x + Math.cos(a) * d, z = camPos.z + Math.sin(a) * d;
      for (let i = 0, y = camPos.y + 300; i < 14; i++, y -= 45) pts.push(new THREE.Vector3(x + (rand() - 0.5) * 60, y, z + (rand() - 0.5) * 60));
      this.bolt.geometry.setFromPoints(pts);
      this.bolt.visible = true; this.boltT = 0.18;
    }
    return { color: this.murk.material.color, see: L.see * (1.5 - k * 0.5), k };
  }
}
const _c1 = new THREE.Color();
