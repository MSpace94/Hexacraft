// La terraformation (lente) : des terraformeurs posés sur une planète changent son air et son climat,
// pour toute la planète, peu à peu (voir main.js ; sauvegardé avec le monde, data.terra).
// Chaque terraformeur, avec son courant (200 W) :
//  - fond la glace d'azote de son coffre : de l'azote, le gaz neutre d'un air respirable (+0,0004 bar
//    par bloc, un bloc toutes les 20 s) ;
//  - verse l'oxygène liquide d'un réseau qui le touche dans l'air (5 mB/s : +0,00002 bar/s) ;
//  - avec de la glace (ou de la glace bleue) dans son coffre, il ensemence l'air de microbes
//    photosynthétiques : ils changent le gaz carbonique (ou le soufre) en oxygène, lentement ;
//  - s'arrête de verser quand l'air ressemble à celui d'Hexa (1 bar, 0,21 bar d'oxygène) ;
//  - rapproche la température de 15 °C : des gaz à effet de serre sur un monde froid (d'autant plus
//    efficaces que l'air est dense), des voiles d'ombre en orbite sur un monde trop chaud.
// Une petite planète sans champ magnétique perd peu à peu son air (le vent de l'étoile l'arrache).
// L'air devient respirable quand il y a assez d'oxygène (au moins 16 %, entre 0,16 et 0,5 bar), presque
// plus de gaz toxique, une pression entre 0,5 et 3 bars et une température entre -20 et 45 °C.
import { gasOf, fieldOf, MIX } from './environ.js?v=1.1.0-mx09tneh';
import { BODY } from './system.js?v=1.1.0-mx09tneh';

export const TERRA_W = 200;
const N2_ICE = 3975, ICES = [3973, 3974], N2_PER = 0.0004, N2_EVERY = 20, O2_MB = 5, O2_PER_MB = 0.000004;
const N2_MAX = 1, O2_MAX = 0.21;
const BIO_EVERY = 30, BIO_PER = 0.0003, HEAT_RATE = 0.002, LEAK = 2e-7;

export class Terraform {
  // g : { bodyAt(q, r), containers, toast }
  constructor(g) {
    this.g = g;
    this.s = {};          // id de l'astre -> { n2, o2, bio (gaz toxique changé en oxygène), dT }
    this.work = new Map(); // terraformeur -> { n2, bio : secondes ; st : état }
  }
  save() { return this.s; }
  load(d) {
    // (les astres modifiés par le monde d'avant : remis comme ils étaient)
    for (const b of Object.values(BODY)) if (b?._terraBase) this.restore(b);
    this.s = {}; this.work.clear();
    if (d && typeof d === 'object') for (const [id, v] of Object.entries(d)) {
      if (!v || typeof v !== 'object') continue;
      this.s[id] = { n2: +v.n2 || 0, o2: +v.o2 || 0, bio: +v.bio || 0, dT: +v.dT || 0 };
      if (BODY[id]) this.apply(BODY[id]);
    }
  }
  restore(b) {
    const B = b._terraBase;
    b.atmo.density = B.density; b.temp = B.temp; b.atmo.breath = B.breath; delete b.gazMix; delete b._terraBase;
  }
  base(b) {
    return (b._terraBase ||= { density: b.atmo?.density || 0, temp: b.temp ?? 0, breath: !!b.atmo?.breath, gas: gasOf(b) });
  }
  // L'air et la température de l'astre, d'après ce qu'on y a changé
  apply(b) {
    const S = this.s[b.id];
    if (!S || !b.atmo) return;
    const B = this.base(b), toxic = B.gas.toxic > 0 ? Math.max(0, B.density - S.bio) : 0;
    const P = Math.max(0, B.density + S.n2 + S.o2), o2 = B.gas.o2 * B.density + S.o2 + S.bio;
    const fo2 = P > 0 ? Math.min(1, o2 / P) : 0, ftox = P > 0 ? toxic / P : 0;
    b.atmo.density = P;
    b.temp = B.temp + S.dT;
    b.gazMix = { name: ftox > 0.01 ? B.gas.name + ', un peu d\'oxygène' : 'azote et oxygène (terraformé)', f: ftox > 0.01 ? B.gas.f + ' O₂' : 'N₂ O₂', o2: fo2, toxic: ftox > 0.01 ? B.gas.toxic : 0, fuel: B.gas.fuel && ftox > 0.5 };
    b.atmo.breath = B.breath || (fo2 >= 0.16 && fo2 * P >= 0.16 && fo2 * P <= 0.5 && ftox <= 0.01 && P >= 0.5 && P <= 3 && b.temp >= -20 && b.temp <= 45);
  }
  // L'état d'une planète, en clair
  summary(b) {
    const B = this.base(b), P = b.atmo.density, g = b.gazMix || gasOf(b);
    return `${b.name} : ${P.toFixed(3).replace('.', ',')} bar (au départ ${B.density.toFixed(2).replace('.', ',')}) · oxygène ${Math.round((g.o2 || 0) * 100)} % · ${Math.round(b.temp)} °C (au départ ${Math.round(B.temp)})${b.atmo.breath ? ' · RESPIRABLE' : ''}`;
  }
  // Un pas d'un terraformeur (industry.js, à chaque pas ; ratio : la part du courant qu'il reçoit)
  tick(k, q, r, y, dt, ratio, nets, drain) {
    const b = this.g.bodyAt(q, r), W = this.work.get(k) || { n2: 0, bio: 0, st: '' };
    this.work.set(k, W);
    W.b = b;
    if (!b || b.kind === 'home' || !b.atmo || b.kind === 'gas' || b.kind === 'ice') { W.st = !b ? 'nowhere' : 'home'; W.on = false; return; }
    W.on = true;
    if (!ratio) { W.st = 'power'; return; }
    const S = (this.s[b.id] ||= { n2: 0, o2: 0, bio: 0, dT: 0 }), B = this.base(b), box = this.g.containers.at(q, r, y), h = dt * ratio, did = [];
    // (un régulateur : il s'arrête quand l'air est comme celui d'Hexa, ~1 bar dont 0,21 d'oxygène)
    const P0 = b.atmo.density, pO2 = (b.gazMix?.o2 ?? B.gas.o2 ?? 0) * P0, full = [];
    // l'azote : un bloc de glace d'azote toutes les 20 s
    if (P0 >= N2_MAX) full.push("d'azote");
    else if (box && count(box, N2_ICE) > 0) {
      W.n2 += h; did.push('azote');
      if (W.n2 >= N2_EVERY) { W.n2 = 0; take(box, N2_ICE); S.n2 += N2_PER; }
    }
    // l'oxygène liquide d'un réseau qui le touche
    const lox = nets.find((n) => n.f === 'lox' && n.n > 0);
    if (lox && pO2 >= O2_MAX) full.push("d'oxygène");
    else if (lox) { const m = Math.min(lox.n, O2_MB * h); drain(lox, m); S.o2 += m * O2_PER_MB; did.push('oxygène'); }
    // les microbes (de la glace : de l'eau) changent le gaz toxique en oxygène
    if (B.gas.toxic > 0 && S.bio < B.density && box && ICES.some((id) => count(box, id) > 0)) {
      W.bio += h; did.push('microbes');
      if (W.bio >= BIO_EVERY) { W.bio = 0; take(box, ICES.find((id) => count(box, id) > 0)); S.bio = Math.min(B.density, S.bio + BIO_PER * Math.max(1, B.density)); }
    }
    // la température : vers 15 °C (l'effet de serre a besoin d'un peu d'air)
    const T = B.temp + S.dT, P = b.atmo.density;
    if (T < 15 && P > 0.05) { S.dT += Math.min(15 - T, HEAT_RATE * h * Math.min(1, P)); did.push('effet de serre'); }
    else if (T > 15) { S.dT -= Math.min(T - 15, HEAT_RATE * h); did.push("voiles d'ombre"); }
    // (une petite planète sans champ magnétique : le vent de l'étoile arrache son air)
    if (fieldOf(b) < 0.3 && (b.gravity ?? 1) < 0.6) { const loss = LEAK * dt * (S.n2 + S.o2); const f = S.n2 + S.o2 > 0 ? loss / (S.n2 + S.o2) : 0; S.n2 -= S.n2 * f; S.o2 -= S.o2 * f; }
    const was = b.atmo.breath;
    this.apply(b);
    if (b.atmo.breath && !was) this.g.toast(b.name + ' : l\'air est devenu respirable !');
    W.st = did.length ? 'work:' + did.join(', ') + (full.length ? ' ; assez ' + full.join(', ') : '') : full.length ? 'work:assez ' + full.join(', ') : 'idle';
  }
  text(k) {
    const W = this.work.get(k), st = W?.st || '';
    if (st === 'nowhere') return "Terraformeur : il faut le poser sur une autre planète";
    if (st === 'home') return 'Terraformeur : rien à faire ici (Hexa, une géante, ou un astre sans sol)';
    if (st === 'power') return 'Terraformeur : il lui faut ' + TERRA_W + ' W';
    const b = W?.b;
    return 'Terraformeur' + (st.startsWith('work:') ? ' (' + st.slice(5) + ')' : " : mets de la glace d'azote (de la glace) dans son coffre, ou relie-le à de l'oxygène liquide") + (b ? ' — ' + this.summary(b) : '');
  }
}
const count = (box, id) => (box.slots || []).reduce((n, s) => n + (s?.id === id ? s.n : 0), 0);
const take = (box, id) => { const s = box.slots.find((x) => x?.id === id); if (s && --s.n <= 0) box.slots[box.slots.indexOf(s)] = null; };
export { MIX };
