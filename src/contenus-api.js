// Le code personnalisé des contenus ajoutés (src/contenus/, voir l'atelier des contenus) : chaque
// contenu peut avoir du code pour ses événements (voir EVENTS dans contenus-reg.js) :
//   code: { utiliser(jeu, e) { ... }, casser(jeu, e) { ... }, chaqueSeconde(jeu, e) { ... } }
// jeu : l'API ci-dessous ; e : l'événement { q, r, y (la case), x, y, z (le point), id, animal... }.
// Le code a accès à tout le jeu (ce sont tes fichiers) : une erreur s'affiche dans le jeu sans le
// planter. En multijoueur, le code tourne chez le joueur qui agit (« chaque seconde » : chez l'hôte).
//
// L'API (jeu.) :
//   message(texte)                       un message à l'écran
//   joueur                               { x, y, z, vie, faim, creatif, regard: { x, y, z } }
//   bloc(q, r, y)                        le numéro du bloc de cette case
//   poserBloc(q, r, y, objet)            pose un bloc (numéro, ou clé d'un contenu)
//   casserBloc(q, r, y)                  le remplace par de l'air
//   case(x, z)                           { q, r } : la case sous ce point
//   explosion(x, y, z, puissance)        puissance : 1 = une TNT
//   donner(objet, nombre)                dans l'inventaire (survie)
//   retirerEnMain(nombre)                retire de l'objet tenu (survie)
//   soigner(points) / nourrir(points)    vie / faim (survie ; 2 points = un cœur)
//   blesser(points)                      enlève de la vie au joueur
//   teleporter(x, y, z)
//   pousser(vx, vy, vz)                  donne de l'élan au joueur
//   apparaitre(espece, x, y, z)          un animal : pig, sheep, cow, hare, fox, villager, zombie, robot...
//   animaux(rayon)                       les animaux autour du joueur [{ espece, x, y, z, vie, frapper(d) }]
//   effet(x, y, z, couleur)              une bouffée de particules
//   id(cle)                              le numéro d'un contenu (ou d'un objet du jeu, par son nom exact)
//   memoire                              un objet gardé pour ce contenu (tant que le jeu tourne)
//   hasard(a, b)                         un nombre au hasard entre a et b
import { ACTIFS, contentOf, ref, isBlockType } from './contenus-reg.js?v=1.1.0-mx09tneh';
import { BLOCKS, ITEMS } from './blocks.js?v=1.1.0-mx09tneh';

export class ContentCode {
  // g : les fonctions du jeu (voir main.js)
  constructor(g) {
    this.g = g;
    this.mem = new Map();
    this.errT = new Map();
    this.clock = 0;
    this.tickAcc = new Map(); // (case -> secondes : « chaque seconde » des blocs posés)
    this.names = null;
  }
  has(num, ev) { return typeof contentOf(num)?.code?.[ev] === 'function'; }
  // Lance le code de l'événement ev du contenu num ; renvoie ce qu'il renvoie (undefined sinon)
  fire(ev, num, e = {}) {
    const c = contentOf(num), fn = c?.code?.[ev];
    if (typeof fn !== 'function') return undefined;
    try { return fn.call(c, this.api(c), { ...e, id: num, evenement: ev }); }
    catch (err) {
      console.error('contenu ' + c.cle + ' (' + ev + ')', err);
      const now = performance.now();
      if ((this.errT.get(c.cle) || 0) < now) { this.errT.set(c.cle, now + 5000); this.g.toast('Erreur dans le code de « ' + (c.nom || c.cle) + ' » (' + ev + ') : ' + err.message); }
      return undefined;
    }
  }
  // Clic droit : sur un bloc ajouté (sans être accroupi), puis avec un objet ajouté en main (pas un
  // bloc : tenu en main, un bloc se pose) ;
  // vrai si un code a répondu (il remplace l'action normale, sauf s'il renvoie false)
  use(held, target, sneak) {
    const h = target?.hit;
    if (h && !sneak) {
      const id = this.g.world.getBlock(h.q, h.r, h.y);
      if (this.has(id, 'utiliser')) return this.fire('utiliser', id, { q: h.q, r: h.r, y: h.y, ...this.center(h), surBloc: true }) !== false;
    }
    if (this.has(held, 'utiliser') && !isBlockType(contentOf(held))) return this.fire('utiliser', held, { ...(h ? { q: h.q, r: h.r, y: h.y } : {}), enMain: true }) !== false;
    return false;
  }
  center(h) { const c = this.g.hexToWorld(h.q, h.r); return { x: c.x, z: c.z, py: h.y + 0.5 }; }
  // (main.js : chaque image) « en main », chaque seconde
  tick(dt) {
    this.clock += dt;
    if (this.clock < 1) return;
    this.clock = 0;
    const held = this.g.held();
    if (this.has(held, 'enMain')) this.fire('enMain', held, {});
  }
  // (industry.js, voir B.tick) un bloc ajouté posé dans le monde : son « chaque seconde »
  blockTick(q, r, y, id, dt) {
    const k = q + ',' + r + ',' + y, t = (this.tickAcc.get(k) || 0) + dt;
    if (t < 1) { this.tickAcc.set(k, t); return; }
    this.tickAcc.set(k, 0);
    const c = this.g.hexToWorld(q, r);
    this.fire('chaqueSeconde', id, { q, r, y, x: c.x, z: c.z, py: y + 0.5 });
  }
  idOf(x) {
    if (Number.isInteger(x)) return x;
    const n = ref(x);
    if (n) return n;
    if (!this.names) {
      this.names = new Map();
      for (const T of [BLOCKS, ITEMS]) for (const [k, v] of Object.entries(T)) if (v?.name && !this.names.has(v.name.toLowerCase())) this.names.set(v.name.toLowerCase(), +k);
    }
    return this.names.get(String(x).toLowerCase()) || 0;
  }
  api(c) {
    const g = this.g, P = g.player, self = this;
    if (!this.mem.has(c.cle)) this.mem.set(c.cle, {});
    const S = () => g.survival();
    return {
      message: (t) => g.toast(String(t)),
      get joueur() {
        const s = S(), d = g.lookDir();
        return { x: P.pos.x, y: P.pos.y, z: P.pos.z, vie: s.health, faim: s.hunger, creatif: !s.on, regard: { x: d.x, y: d.y, z: d.z } };
      },
      bloc: (q, r, y) => g.world.getBlock(q, r, y),
      poserBloc: (q, r, y, o) => { const id = self.idOf(o); return !!(BLOCKS[id] && g.world.setBlock(q, r, y, id)); },
      casserBloc: (q, r, y) => !!g.world.setBlock(q, r, y, 0),
      case: (x, z) => g.worldToHex(x, z),
      explosion: (x, y, z, p = 1) => g.explode(x, y, z, Math.max(0.2, Math.min(1000, +p || 1))),
      donner: (o, n = 1) => { const id = self.idOf(o); if (id && S().on) S().give(id, Math.max(1, Math.min(999, n | 0))); },
      retirerEnMain: (n = 1) => { if (S().on) for (let i = 0; i < n; i++) g.useHeld(); },
      soigner: (p) => { if (S().on && +p > 0) S().heal(+p); },
      nourrir: (p) => { if (S().on && +p > 0) S().eat(+p); },
      blesser: (p) => { if (+p > 0) S().damage(+p); },
      teleporter: (x, y, z) => { P.pos.set(+x, +y, +z); P.vel.set(0, 0, 0); },
      pousser: (vx, vy, vz) => { P.vel.x += +vx || 0; P.vel.y += +vy || 0; P.vel.z += +vz || 0; P.onGround = false; },
      apparaitre: (sp, x, y, z) => !!g.spawn(sp, +x, +y, +z),
      animaux: (R = 16) => g.animals.list.filter((a) => !a.dead && Math.hypot(a.pos.x - P.pos.x, a.pos.z - P.pos.z) <= R).map((a) => ({ espece: a.type, x: a.pos.x, y: a.pos.y, z: a.pos.z, vie: a.hp, frapper: (d) => g.hitAnimal(a, +d || 1) })),
      effet: (x, y, z, col = '#ffffff') => g.puff(+x, +y, +z, String(col)),
      id: (x) => self.idOf(x),
      memoire: this.mem.get(c.cle),
      hasard: (a = 0, b = 1) => a + Math.random() * (b - a),
      contenus: ACTIFS.map((o) => o.cle),
    };
  }
}
