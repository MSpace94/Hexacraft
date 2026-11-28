// L'environnement des autres mondes, ressenti par le joueur (voir main.js, updateAir) :
//  - la composition de l'air : respirable, inerte (on étouffe), toxique (plus vite), inflammable ;
//    le feu (les fours) a besoin d'oxygène ;
//  - la pression : trop basse, on s'essouffle (puis l'hypoxie) ; trop haute, l'ivresse des profondeurs
//    (l'azote), puis l'oxygène devient toxique ; une combinaison étanche ne tient qu'une pression donnée ;
//  - la température ressentie : la combinaison isole (le casque spatial : de -120 à 120 °C, le scaphandre
//    lourd : de -240 à 480 °C) ; un abri étanche (une pièce avec un générateur d'oxygène, voir orbital.js)
//    est chauffé ou refroidi ; dans un air très mince, on perd (ou gagne) la chaleur lentement ;
//  - le rayonnement : les ceintures des géantes gazeuses (comme celles de Jupiter : Io y reçoit ~36 Sv par
//    jour, Europe ~5), le vent des pulsars et des magnétars, le rayonnement cosmique dans l'espace et sur
//    les astres sans air ni champ magnétique. L'air, le champ magnétique, la roche au-dessus de la tête,
//    la coque d'un vaisseau et le scaphandre lourd protègent. On ne le sent pas : le dosimètre le mesure.
// Hexa et Vesper gardent leur climat (voir seasons.js, updateHeat, updateClimate dans main.js).
import * as THREE from 'three';
import { airOfBody, isGiant, KELVIN, SUIT_P } from './atmo.js?v=1.1.0-mx09tneh';
import { BODY, BODIES, systemOf } from './system.js?v=1.1.0-mx09tneh';
import { SOLID } from './blocks.js?v=1.1.0-mx09tneh';
import { worldToHex, hexToWorld, NEIGHBORS } from './hex.js?v=1.1.0-mx09tneh';

export const HEAVY_P = 100;         // (bars : ce que tient le scaphandre lourd ; Vénus : 92)
export const SPACE_HELMET_ID = 3968, HEAVY_SUIT_ID = 4618, DOSIMETER_ID = 4619;
// Ce qu'on porte sur la tête : étanche ou pas, la plage de température tenue (°C), la pression tenue,
// la part du rayonnement qui passe
const GEAR = {
  0: { sealed: false, lo: -15, hi: 45, P: Infinity, rad: 1 },
  [SPACE_HELMET_ID]: { sealed: true, lo: -120, hi: 120, P: SUIT_P, rad: 0.9, name: 'Le casque spatial' },
  [HEAVY_SUIT_ID]: { sealed: true, lo: -240, hi: 480, P: HEAVY_P, rad: 0.35, name: 'Le scaphandre lourd' },
};
export const gearOf = (id) => GEAR[id] || GEAR[0];
export const sealedHead = (id) => !!GEAR[id]?.sealed;
// (la combinaison, dans une géante : voir spaceflight.js)
export const suitP = (id) => (id === HEAVY_SUIT_ID ? HEAVY_P : SUIT_P);
export const suitSkin = (id) => (id === HEAVY_SUIT_ID ? 760 : 420);

// ---------- La composition de l'air ----------
// o2 : la part d'oxygène ; toxic : à quel point on étouffe plus vite (le gaz carbonique, le soufre) ;
// fuel : inflammable (il brûle avec de l'oxygène)
export const MIX = {
  air: { name: 'azote et oxygène', f: 'N₂ O₂', o2: 0.21, toxic: 0 },
  o2: { name: 'oxygène', f: 'O₂', o2: 1, toxic: 0 },
  n2: { name: 'azote', f: 'N₂', o2: 0, toxic: 0 },
  co2: { name: 'gaz carbonique', f: 'CO₂', o2: 0, toxic: 1 },
  so2: { name: 'gaz carbonique et soufre', f: 'CO₂ SO₂', o2: 0, toxic: 2.5 },
  ch4: { name: 'azote et méthane', f: 'N₂ CH₄', o2: 0, toxic: 0, fuel: true },
  h2: { name: 'hydrogène et hélium', f: 'H₂ He', o2: 0, toxic: 0, fuel: true },
  none: { name: 'vide', f: '—', o2: 0, toxic: 0 },
};
// (un astre peut la donner : gaz: 'co2' ; sinon, on la devine de ce qu'on sait de lui)
export function gasOf(b) {
  if (!b?.atmo?.density) return MIX.none;
  if (b.gazMix) return b.gazMix; // (terraformé : voir terraform.js)
  if (b.gaz && MIX[b.gaz]) return MIX[b.gaz];
  if (isGiant(b)) return MIX.h2;
  if (b.atmo.breath) return MIX.air;
  const t = b.temp ?? 0;
  if (/toxique|soufr/i.test(b.desc || '') || t > 120) return MIX.so2;
  if (t < -140 && b.atmo.density >= 0.5) return MIX.ch4;
  return MIX.co2;
}

// ---------- Le champ magnétique ----------
// 1 : comme la Terre ; 0 : aucun (Mars, la Lune). Un astre peut le donner (champ: 0..2) ; sinon : les
// géantes (et leurs ceintures), Hexa, les planètes rocheuses assez grosses qui tournent vite (une dynamo)
const RE = 14000;
export function fieldOf(b) {
  if (!b) return 0;
  if (Number.isFinite(b.champ)) return b.champ;
  if (b.kind === 'home' || isGiant(b)) return 1;
  if (b.kind === 'rock' && b.R >= 0.6 * RE && (b.day ?? 1) < 3) return 0.6;
  return 0;
}

// ---------- Le rayonnement (mSv/h, sans protection) ----------
const AU = 6.6e7;
const COSMIC = 0.06, SURFACE = 0.03, HOME = 0.0003; // (l'espace lointain, un sol sans air ni champ, la Terre)
const PULSAR_K = 60, MAGNETAR_K = 200;              // (à 1 UA)
// Les ceintures d'une géante, à r rayons de son centre : ~1500 mSv/h à 6 rayons (Io), ~220 à 9 (Europe)
export function beltRate(r) {
  if (r < 1.05) return 0;
  return r < 5.9 ? 1500 * Math.min(1, (r - 1.05) / 2) : 1500 * Math.exp(-(r - 5.9) * 0.55);
}
let pulsars = [], nBodies = -1;
function pulsarList() {
  if (BODIES.length !== nBodies) { nBodies = BODIES.length; pulsars = BODIES.filter((b) => b.pulsar); }
  return pulsars;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export class Environ {
  // g : { player, survival, flight, orbital, world, seasons, toast, water(), structOn(), hasItem(id), fx() }
  constructor(g) {
    this.g = g;
    this.dose = 0;            // (mSv reçus ; la moitié s'en va en ~1 h loin de tout rayonnement)
    this.rate = 0;            // (mSv/h ici, protections comprises)
    this.T = null;            // (°C ressentis dehors, null : le climat d'Hexa ou de Vesper)
    this.P = 1; this.gas = MIX.air; this.body = null;
    this.hot = false; this.cold = false; this.narc = 0; this.hypox = 0;
    this.breath = 1;          // (essoufflement : la course, 1 : normale)
    this.hurt = { T: 0, P: 0, rad: 0, O2: 0 };
    this.said = new Set();
    this.clock = 0;
    const mk = () => ({ rho: 0, P: 0, T: 270, vair: new THREE.Vector3(), up: new THREE.Vector3(), g: 0, giant: false, layer: null, body: null, alt: 0 });
    this._air = mk(); this._fire = mk(); this._v = new THREE.Vector3(); this._p = new THREE.Vector3();
    this.tilt = ''; this.blur = '';
    this.el = null;
  }
  say(k, msg) { if (!this.said.has(k)) { this.said.add(k); this.g.toast(msg); } }
  unsay(k) { this.said.delete(k); }

  // L'air ici (pression, température, astre)
  sample() {
    const { flight, player } = this.g, A = this._air;
    if (flight.on) {
      flight.airOf(player.pos, A);
      if (!A.body && flight.inVoid) {
        const B = flight.bubbleAt(player.pos.x, player.pos.z);
        A.near = B && !B.dim7 ? BODY[B.ref] : null;
      } else A.near = A.body;
    } else { airOfBody(BODY.hexa, player.pos.y - 64, A); A.body = A.near = BODY.hexa; }
    return A;
  }

  // Ma position dans le système (blocs), ou null
  absPos(out) {
    const { flight, player } = this.g;
    if (!flight.on) return null;
    const A = this._air;
    if (A.body && !flight.inVoid) { const o = flight.bp[A.body.id]; return o ? Object.assign(out, o) : null; }
    const B = flight.bubbleAt(player.pos.x, player.pos.z);
    if (!B || B.dim7 || !flight.bp[B.ref]) return null;
    return flight.toAbs(B, player.pos, out);
  }

  // Le rayonnement ici, sans le scaphandre (mSv/h)
  radiation() {
    const { flight } = this.g, A = this._air, b = A.near;
    if (!flight.on) return HOME;
    let charged = 0, cosmic = flight.inVoid ? COSMIC : SURFACE;
    if (b?.kind === 'home') cosmic = HOME;
    const p = this.absPos(this._v);
    if (p) {
      // les pulsars et les magnétars du système (leur vent de particules)
      const sys = b ? systemOf(b) : null;
      for (const s of pulsarList()) {
        const o = flight.bp[s.id];
        if (!o || (sys && systemOf(s) !== sys)) continue;
        const d = Math.max(0.02, dist(p, o) / AU);
        if (d < 30) charged += (s.beams === false || /magn/i.test(s.name + (s.desc || '')) ? MAGNETAR_K : PULSAR_K) / (d * d);
      }
      // les ceintures des géantes : la géante d'ici, ou celle autour de laquelle tourne cette lune
      const G = b && isGiant(b) ? b : b?.parent && isGiant(BODY[b.parent]) ? BODY[b.parent] : null;
      if (G && flight.bp[G.id]) {
        const r = dist(p, flight.bp[G.id]) / G.R;
        // (posé sur une lune : elle cache la moitié du ciel)
        charged += beltRate(r) * (A.body && A.body !== G ? 0.5 : 1);
      }
    }
    // le champ magnétique de l'astre détourne les particules chargées ; l'air arrête presque tout
    // (1 bar : un vingtième passe)
    const field = A.body ? fieldOf(A.body) : 0, air = Math.exp(-3 * Math.max(0, A.P || 0));
    // (au sol d'une géante, plus de ceintures : on est sous elles)
    return (charged * (1 - 0.9 * Math.min(1, field) * (A.body && !isGiant(A.body) ? 1 : 0)) + cosmic) * air;
  }

  // Ce qui protège encore : la roche (ou l'eau) au-dessus de la tête, la coque d'un vaisseau
  shielding() {
    const { player, world, structOn } = this.g;
    let k = 1;
    if (player.pilot || structOn?.()) k *= 0.5;
    const h = worldToHex(player.pos.x, player.pos.z), y0 = Math.floor(player.pos.y + 1.6);
    let n = 0;
    for (let y = y0 + 1; y < y0 + 24 && n < 12; y++) { const id = world.getBlock(h.q, h.r, y); if (SOLID[id] === 1 || id === 6 || id === 7) n++; }
    return k * Math.exp(-n / 2);
  }

  // La température ressentie dehors (°C), ou null (le climat d'Hexa, de Vesper : déjà géré)
  feltT() {
    const { seasons, flight } = this.g, A = this._air, b = A.body;
    if (!flight.on || !b || b.kind === 'home' || b.locked) return null;
    if (A.giant) return A.T - KELVIN;
    if (flight.inVoid) return null;
    // (le climat d'ici, décalé de celui d'Hexa : le jour, la nuit, l'altitude, les gâteaux chauffants)
    return (b.temp ?? 0) + ((seasons.here ?? 12) - 12) * 0.6;
  }

  update(dt) {
    const g = this.g, { survival: sv, player } = g;
    if ((this.clock -= dt) > 0) return this.fx(dt);
    const step = 0.25 - this.clock; this.clock = 0.25;
    const A = this.sample(), head = sv.head?.id || 0, gear = gearOf(head);
    const inside = !!(player.pilot || g.orbital.breathable());
    this.body = A.body; this.P = A.P || 0;
    this.gas = this.P > 0.001 ? gasOf(A.body || A.near) : MIX.none;
    this.T = this.feltT();
    // ---------- le rayonnement ----------
    this.rate = this.radiation() * this.shielding() * gear.rad;
    // (1 s de jeu : une minute d'exposition)
    if (this.rate > 0.1) this.dose += (this.rate * step) / 60;
    else this.dose = Math.max(0, this.dose - this.dose * step / 5000 - step * 0.05);
    const live = sv.on && !sv.dead && g.playing() && !player.fly;
    if (!live) { this.hot = this.cold = false; this.narc = this.hypox = 0; this.breath = 1; sv.envDrain = 0; return this.fx(dt); }
    const hurt = (k, every, msgKey, msg) => {
      this.hurt[k] += step;
      if (this.hurt[k] >= every) { this.hurt[k] = 0; sv.damage(1); if (msgKey) this.say(msgKey, msg); }
    };
    // la dose : la nausée (1 Sv), puis le mal des rayons
    const D = this.dose;
    sv.envDrain = D > 1000 ? Math.min(2, (D - 1000) / 2000) : 0;
    if (D > 1000) this.say('nausee', 'Tu as reçu ' + fmtDose(D) + ' : nausées, le mal des rayons commence. Éloigne-toi, abrite-toi sous la roche'); else this.unsay('nausee');
    if (D > 3000) hurt('rad', D > 10000 ? 0.7 : D > 6000 ? 2 : 6, 'rayons', 'Le mal des rayons te ronge (' + fmtDose(D) + ')');
    else this.hurt.rad = 0;
    if (this.rate > 50) this.say('rad-fort', g.hasItem(DOSIMETER_ID) ? 'Le dosimètre crépite : ' + fmtRate(this.rate) + ' !' : "Ta peau picote... il y a peut-être du rayonnement ici (un dosimètre le mesurerait)");
    else if (this.rate < 10) this.unsay('rad-fort');
    // ---------- la température ----------
    const T = inside ? null : this.T;
    this.hot = T != null && T > gear.hi && !g.water();
    this.cold = T != null && T < gear.lo;
    // (dans un air très mince, la chaleur passe mal : on tient bien plus longtemps)
    const couple = Math.max(0.15, Math.min(1, 0.15 + this.P));
    if (this.hot || this.cold) {
      const over = this.hot ? T - gear.hi : gear.lo - T;
      hurt('T', Math.max(0.5, 4 - over / 15) / couple, this.hot ? 'chaud' : 'froid',
        (this.hot ? `Il fait ${Math.round(T)} °C` : `Il fait ${Math.round(T)} °C`) + (gear.name ? ` : ${gear.name.toLowerCase()} ne tient que ${this.hot ? gear.hi : gear.lo} °C` : this.hot ? ' : la chaleur te brûle. Il te faut une combinaison, ou un abri' : ' : le froid te gèle. Il te faut une combinaison, ou un abri chauffé'));
    } else { this.hurt.T = 0; this.unsay('chaud'); this.unsay('froid'); }
    // ---------- la pression ----------
    this.narc = 0; this.hypox = 0; this.breath = 1;
    if (!inside && gear.sealed && !g.flight.inVoid && this.P > gear.P) hurt('P', Math.max(0.3, 2.5 - (this.P - gear.P) / gear.P * 4), 'ecrase', `La pression t'écrase : ${this.P.toFixed(0)} bars ! ${gear.name} n'en tient que ${gear.P}`);
    else if (!gear.sealed && !inside && this.gas.o2 > 0) {
      const pO2 = this.gas.o2 * this.P, pN2 = (1 - this.gas.o2) * this.P;
      // (moins de 0,1 bar d'oxygène : on s'essouffle, on court mal ; moins de 0,05 : l'hypoxie)
      if (pO2 < 0.1) {
        this.hypox = Math.min(1, (0.1 - pO2) / 0.06); this.breath = 1 - this.hypox * 0.8;
        this.say('souffle', "L'air est rare ici : tu t'essouffles");
        if (pO2 < 0.05) hurt('O2', 2.5, 'hypoxie', "L'hypoxie : tu manques d'oxygène, redescends !");
      } else this.unsay('souffle');
      // (au-delà de ~3 bars d'azote, l'ivresse des profondeurs ; au-delà de 1,6 bar d'oxygène, il devient toxique)
      if (pN2 > 3.2) { this.narc = Math.min(1, (pN2 - 3.2) / 5); this.say('narcose', "L'ivresse des profondeurs : l'azote sous pression te monte à la tête"); }
      if (pO2 > 1.6) hurt('O2', 2, 'o2tox', "Trop d'oxygène sous cette pression : il devient toxique (convulsions)");
      if (pO2 >= 0.05 && pO2 <= 1.6) this.hurt.O2 = 0;
    } else { this.hurt.P = 0; this.hurt.O2 = 0; }
    return this.fx(dt);
  }
  // L'air (inerte ou toxique) : combien de secondes entre deux demi-cœurs quand on étouffe (main.js, updateAir)
  chokeEvery() { return 2 / (1 + (this.gas.toxic || 0)); }
  // Le feu prend-il ici (un four, voir containers.js) ? Il faut de l'oxygène
  // (cellule q, r, y ; le résultat est gardé 1 s : les fours le demandent à chaque image)
  fireOk(q, r, y) {
    const { flight, orbital } = this.g;
    if (!flight.on) return true;
    const k = q + ',' + r + ',' + y, now = performance.now(), M = (this.fireMemo ||= new Map()), m = M.get(k);
    if (m && now - m.t < 1000) return m.ok;
    // (dans une pièce étanche, avec un générateur d'oxygène : voir orbital.js)
    const R = orbital.rooms;
    let ok = !!(R && (R.has(q + ',' + r + ',' + (y + 1)) || R.has(q + ',' + r + ',' + (y - 1)) || NEIGHBORS.some(([dq, dr]) => R.has((q + dq) + ',' + (r + dr) + ',' + y))));
    if (!ok) {
      const c = hexToWorld(q, r), A = flight.airOf(this._p.set(c.x, y + 0.5, c.z), this._fire);
      const gas = A.P > 0.001 ? gasOf(A.body) : MIX.none;
      ok = gas.o2 * A.P >= 0.05;
    }
    if (M.size > 256) M.clear();
    M.set(k, { t: now, ok });
    return ok;
  }

  // ---------- Ce qu'on voit (option « Effets à l'écran ») et le dosimètre ----------
  fx(dt) {
    const lvl = this.g.fx?.() ?? 1, el = this.el || this.build();
    const sv = this.g.survival, on = sv.on && !sv.dead;
    const cold = on && lvl > 0 && this.cold ? 1 : 0, hot = on && lvl > 0 && this.hot ? 1 : 0;
    const rad = on && lvl > 0 ? Math.min(1, Math.max(0, (this.dose - 800) / 4000)) : 0;
    const hyp = on && lvl > 0 ? this.hypox : 0, narc = on && lvl > 0 ? this.narc : 0;
    this.k = this.k || { cold: 0, hot: 0, rad: 0, hyp: 0, narc: 0 };
    const K = this.k, e = Math.min(1, dt * 1.5);
    K.cold += (cold - K.cold) * e; K.hot += (hot - K.hot) * e; K.rad += (rad - K.rad) * e; K.hyp += (hyp - K.hyp) * e; K.narc += (narc - K.narc) * e;
    const any = K.cold + K.hot + K.rad + K.hyp + K.narc > 0.01;
    el.ov.style.display = any ? '' : 'none';
    if (any) {
      el.ov.style.boxShadow = [
        K.cold > 0.01 ? `inset 0 0 ${220 * K.cold}px ${40 * K.cold}px rgba(170, 220, 255, ${0.6 * K.cold})` : '',
        K.hot > 0.01 ? `inset 0 0 ${240 * K.hot}px ${40 * K.hot}px rgba(255, 110, 30, ${0.55 * K.hot})` : '',
        K.hyp > 0.01 ? `inset 0 0 ${320 * K.hyp}px ${120 * K.hyp}px rgba(0, 0, 0, ${0.85 * K.hyp})` : '',
      ].filter(Boolean).join(',') || 'none';
      // (le mal des rayons : un voile verdâtre qui palpite ; l'ivresse : la vue tangue, en effets complets)
      const t = performance.now() / 1000;
      el.ov.style.background = K.rad > 0.01 ? `rgba(120, 200, 60, ${K.rad * (0.08 + 0.05 * Math.sin(t * 2.3))})` : 'transparent';
      this.tilt = lvl >= 2 && K.narc > 0.01 ? `rotate(${(Math.sin(t * 0.9) * 1.5 * K.narc).toFixed(3)}deg) scale(${(1 + 0.03 * K.narc).toFixed(4)})` : '';
      this.blur = lvl >= 2 && K.narc > 0.01 ? `blur(${(K.narc * 1.5).toFixed(2)}px)` : '';
    } else this.tilt = this.blur = '';
    // le dosimètre (dans l'inventaire), et ce qu'affiche la combinaison qu'on porte
    const head = sv.head?.id || 0, dosi = this.g.hasItem(DOSIMETER_ID), suit = sealedHead(head) && this.g.flight.on;
    const show = (dosi || suit) && this.g.playing() && !this.g.hidden?.();
    el.hud.style.display = show ? '' : 'none';
    if (show && (this._hudT = (this._hudT || 0) - dt) <= 0) {
      this._hudT = 0.25;
      const rows = [];
      if (suit) {
        const T = this.T ?? (this.g.seasons.here ?? 12);
        rows.push(`<b>${Math.round(T)} °C</b> · <b>${fmtP(this.P)}</b> · ${this.gas.f}${this.gas.fuel ? ' <span class="warn">inflammable</span>' : this.gas.toxic ? ' <span class="warn">toxique</span>' : ''}`);
      }
      if (dosi) {
        const c = this.rate > 50 ? 'bad' : this.rate > 2 ? 'warn' : 'ok', d = this.dose > 3000 ? 'bad' : this.dose > 1000 ? 'warn' : '';
        rows.push(`☢ <b class="${c}">${fmtRate(this.rate)}</b> · dose <b class="${d}">${fmtDose(this.dose)}</b>`);
      }
      el.hud.innerHTML = rows.join('<br>');
    }
  }
  build() {
    const ov = document.createElement('div'), hud = document.createElement('div');
    ov.id = 'env-fx'; hud.id = 'env-hud';
    ov.style.display = hud.style.display = 'none';
    document.body.append(ov, hud);
    return (this.el = { ov, hud });
  }
  save() { return Math.round(this.dose); }
  load(d) { this.dose = Number.isFinite(d) ? Math.max(0, d) : 0; this.said.clear(); }
}

export const fmtP = (P) => (P < 0.001 ? 'vide' : P < 0.1 ? (P * 1000).toFixed(0) + ' mbar' : P < 10 ? P.toFixed(2).replace('.', ',') + ' bar' : Math.round(P) + ' bars');
export const fmtRate = (r) => (r < 0.01 ? (r * 1000).toFixed(1).replace('.', ',') + ' µSv/h' : r < 10 ? r.toFixed(2).replace('.', ',') + ' mSv/h' : r < 1000 ? Math.round(r) + ' mSv/h' : (r / 1000).toFixed(1).replace('.', ',') + ' Sv/h');
export const fmtDose = (d) => (d < 1000 ? Math.round(d) + ' mSv' : (d / 1000).toFixed(2).replace('.', ',') + ' Sv');
