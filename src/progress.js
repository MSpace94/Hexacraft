// Tiers technologiques : 6 étapes de progression, chacune avec ses objectifs, vérifiés tout seuls.
// Ce n'est qu'un guide : aucune recette n'est bloquée. ORA (l'IA du tutoriel) donne de temps en
// temps un conseil selon la situation (Options : souvent / parfois / jamais).
// L'état est sauvegardé avec le monde (data.progress) ; un ancien monde valide d'un coup ce qu'il
// a déjà (et, quand un objectif d'un tier est atteint, tout ce qui précède).
import {
  BLOCKS, CRAFTING_TABLE, FURNACE, IRON_INGOT, isLog, isFurnace, STONE_PICKAXE, STONE_HOE,
  RAIL_SIGNAL, PUMP, REFINERY, NEDROLYTIUM, NED_INGOT, REACTOR, SPACE_HELMET, TORCH, COAL,
} from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { zoneBody, zoneOfXZ } from './spacegen.js?v=1.1.5-alpha-mwgq2wrb';
import { systemOf, systemNear } from './system.js?v=1.1.5-alpha-mwgq2wrb';
import { translate } from './i18n.js?v=1.1.5-alpha-mwgq2wrb';
import * as THREE from 'three';

const _v = new THREE.Vector3();
const isSignal = (id) => id >= RAIL_SIGNAL && id < RAIL_SIGNAL + 6;

// ---------- Les tiers ----------
// objectif : { id, goal, hint (conseil d'ORA quand on y bloque), check(ctx) -> true | 'texte de progression' }
export const TIERS = [
  {
    id: 'survie', name: 'Survie',
    goals: [
      { id: 'bois', goal: 'Couper du bois', hint: 'Frappe un tronc d\'arbre jusqu\'à ce qu\'il se casse.', check: (c) => c.has(isLog) || c.placed.has('log') },
      { id: 'etabli', goal: 'Fabriquer un établi', hint: 'Transforme ton bois en planches, puis assemble un établi dans l\'inventaire.', check: (c) => c.count(CRAFTING_TABLE) > 0 || c.placed.has('table') },
      { id: 'outils', goal: 'Fabriquer un outil en pierre', hint: 'Sur l\'établi : des cailloux et des bâtons donnent une pioche en pierre.', check: (c) => c.has((id) => id >= STONE_PICKAXE && id <= STONE_HOE) },
      { id: 'four', goal: 'Poser un four', hint: 'Un four se fabrique avec de la pierre, sur l\'établi.', check: (c) => c.placed.has('furnace') || c.count(FURNACE) > 0 },
      { id: 'fer', goal: 'Obtenir un lingot de fer', hint: 'Mets du minerai de fer et du charbon dans un four.', check: (c) => c.count(IRON_INGOT) > 0 },
    ],
  },
  {
    id: 'rails', name: 'Vapeur et rails',
    goals: [
      { id: 'voie', goal: 'Poser 50 rails de train', hint: 'Les rails de train se posent bout à bout ; les virages se font tout seuls.', check: (c) => (c.rails >= 50 ? true : `${c.rails} / 50`) }, // (les rails posés à la main : pas ceux des mines abandonnées)
      { id: 'loco', goal: 'Mettre une locomotive sur les rails', hint: 'Pose une locomotive sur ta voie, puis monte dans la cabine.', check: (c) => c.trains.trains.some((t) => t.cars.some((k) => k.kind === 'loco')) },
      { id: 'wagon', goal: 'Charger un wagon', hint: 'Accroche un wagon à ta locomotive et remplis-le.', check: (c) => c.trains.trains.some((t) => t.cars.some((k) => k.box?.slots.some((s) => s) || k.deck?.list?.length)) },
      { id: 'signal', goal: 'Poser un signal ferroviaire', hint: 'Les signaux arrêtent les trains automatiques tant que la voie est occupée.', check: (c) => c.tracks.props.some((p) => p.kind === 'signal') },
      { id: 'auto', goal: 'Un trajet automatique jusqu\'à une gare', hint: 'Pose deux gares, monte dans la locomotive et lance le pilote automatique ({autopilot}).', check: (c) => c.trains.trains.some((t) => t.auto && t.lastStop) },
    ],
  },
  {
    id: 'industrie', name: 'Industrie',
    goals: [
      { id: 'courant', goal: 'Alimenter un réseau électrique', hint: 'Relie un générateur à une machine avec des câbles.', check: (c) => c.ind.nets.some((n) => n.gens.length && n.prod > 0) },
      { id: 'machine', goal: 'Faire tourner une machine', hint: 'Une machine branchée sur un réseau qui produit assez de courant se met au travail.', check: (c) => c.ind.nets.some((n) => n.users.length && n.ratio > 0) },
      { id: 'tapis', goal: 'Poser un tapis roulant', hint: 'Les tapis emmènent les objets d\'une machine à l\'autre.', check: (c) => c.ind.belts.size > 0 },
      { id: 'pompe', goal: 'Poser une pompe à eau', hint: 'Une pompe électrique, posée contre de l\'eau, remplit les tuyaux.', check: (c) => c.hasNode(PUMP) },
      { id: 'raffinerie', goal: 'Construire une raffinerie', hint: 'La raffinerie mélange charbon, soufre et eau pour faire du carburant.', check: (c) => c.hasNode(REFINERY) },
      { id: 'carburant', goal: 'Stocker 1 000 mB de carburant primaire', hint: 'Relie la sortie de la raffinerie à un réservoir.', check: (c) => { const n = Math.floor(c.fuel()); return n >= 1000 ? true : `${n} / 1 000 mB`; } },
    ],
  },
  {
    id: 'fusees', name: 'Fusées',
    goals: [
      { id: 'lingot', goal: 'Obtenir un lingot de nédrolytium', hint: 'Le creuset mélange les poudres du concasseur : tungstène, platine, fluorite, cramoisite et voltite.', check: (c) => c.count(NED_INGOT) > 0 },
      { id: 'bloc', goal: 'Fabriquer un bloc de nédrolytium', hint: 'Neuf lingots de nédrolytium font un bloc.', check: (c) => c.count(NEDROLYTIUM) > 0 || c.placed.has('ned') },
      { id: 'moteur', goal: 'Une fusée avec réacteur et tuyère', hint: 'Colle ensemble un réacteur, un bloc de nédrolytium contre lui, un réservoir et des tuyères.', check: (c) => c.structs.list.some((s) => { let a = false, b = false; for (const id of s.blocks.values()) { if (id === REACTOR) a = true; else if (BLOCKS[id]?.thrust) b = true; } return a && b; }) },
      { id: 'decollage', goal: 'Décoller', hint: 'Assieds-toi au poste de pilotage et pousse les gaz.', check: (c) => { const P = c.player.pilot; return !!(P && !P.passenger && !P.car && P.s.vel && P.s.vel.y > 3); } },
      { id: 'espace', goal: 'Sortir dans l\'espace', hint: 'Monte tout droit : au-dessus de l\'atmosphère, c\'est l\'espace.', check: (c) => c.flight.inVoid },
      { id: 'planete', goal: 'Se poser sur une autre planète', hint: 'Vise un astre, approche-toi, puis descends doucement : les pieds d\'atterrissage aident.', check: (c) => c.flight.zone > 0 && c.player.onGround },
    ],
  },
  {
    id: 'interstellaire', name: 'Interstellaire',
    goals: [
      { id: 'saut', goal: 'Faire un saut nédrolytique', hint: 'Dans l\'espace, avec un réacteur armé et du carburant : {k:J} lance le saut.', check: (c) => !!c.flight.warpFly || c.structs.list.some((s) => s.warp) },
      { id: 'casque', goal: 'Porter un casque spatial', hint: 'Sans air, il te faut un casque : mets-le dans la case de tête de l\'inventaire.', check: (c) => c.headId() === SPACE_HELMET },
      { id: 'pxt', goal: 'Atteindre le système PXT', hint: 'Cible l\'étoile du système PXT et enchaîne les sauts.', check: (c) => c.system() === 'pxta' },
      { id: 'pxtsol', goal: 'Se poser sur une planète PXT', hint: 'Choisis une planète du système PXT et pose-toi.', check: (c) => c.flight.zone > 0 && zoneBody(c.flight.zone)?.id.startsWith('pxt') && c.player.onGround },
    ],
  },
  {
    id: 'colonisation', name: 'Colonisation',
    goals: [
      { id: 'station', goal: 'Poser un noyau de station en orbite', hint: 'Dans l\'espace, autour d\'un astre, pose un noyau de station : tout ce qui est dans sa bulle devient ta station.', check: (c) => !!c.orbital && [...c.orbital.sites.values()].some((s) => s.orbit) },
      { id: 'oxygene', goal: 'Rendre une pièce respirable', hint: 'Une pièce bien fermée qui touche un générateur d\'oxygène alimenté se remplit d\'air.', check: (c) => !!c.orbital && c.orbital.rooms.size > 0 },
      { id: 'cargo', goal: 'Envoyer un cargo vers un autre site', hint: 'Un lanceur de cargo alimenté envoie le contenu des entrepôts orbitaux de son site vers ceux d\'un autre.', check: (c) => !!c.orbital?.cargoSent },
      { id: 'drones', goal: 'Envoyer des drones de minage', hint: 'Range des drones de minage dans une baie de drones alimentée, assez près de la ceinture d\'astéroïdes.', check: (c) => !!c.orbital?.dronesOut },
      { id: 'colonie', goal: 'Installer 3 villageois sur une autre planète', hint: 'Recrute des villageois : ils te suivent. Pose-toi sur une autre planète et descends du vaisseau, ils te rejoignent.', check: (c) => { const n = c.colonists(); return n >= 3 ? true : `${n} / 3`; } },
    ],
  },
  // la fin du jeu (voir ending.js) : jamais validée d'avance par les tiers d'après (il n'y en a pas),
  // et elle ne valide pas non plus ceux d'avant (final)
  {
    id: 'signal', name: 'Le signal', final: true,
    goals: [
      { id: 'balise', goal: "Poser une balise interstellaire dans l'épave du Traveler-98", hint: "La balise se branche sur l'antenne du Traveler-98 : pose-la dans son épave, loin de tout village.", check: (c) => c.beacon() },
      { id: 'message', goal: 'Envoyer le message vers la Terre', hint: 'Alimente la balise : il lui faut 250 W pendant 45 secondes.', check: (c) => c.placed.has('signal') },
    ],
  },
];

// Répliques d'ORA en arrivant dans un tier (tirées des rapports du Traveler-98, voir lore.js)
export const GREET = {
  survie: [
    "Ici ORA. Ma liaison avec toi tient encore, cadet. Le HEXA-7 est perdu, mais pas toi.",
    "Abri, outils, nourriture : comme à Hexa-Zéro. Sauf qu'ici, personne ne remet les leçons à zéro.",
  ],
  rails: [
    "Tu tiens debout. Maintenant, il faut couvrir de la distance.",
    "L'épave du Traveler-98 s'est écrasée loin de tout village, il y a 241 ans. À pied, tu n'y arriveras pas : construis des rails.",
  ],
  industrie: [
    "Les rails roulent. Il est temps de produire plus que ce que tes mains peuvent porter.",
    "Bryan Space a remis en marche un fabricateur avec un seul régulateur récupéré. Toi, tu pars de rien : une usine, une machine après l'autre.",
    "Garde en tête la règle de son rapport : jamais de matière inconnue dans une machine sans analyse.",
  ],
  fusees: [
    "Le carburant coule. Le Destiny-InterSpace volait au nédrolytium : tungstène, platine, fluorite, cramoisite, voltite.",
    "Le nédrolytium ne crée pas d'énergie, il la convertit. Sans réserve, pas de poussée. Pense à tes réservoirs.",
    "L'équipage du Traveler-98 n'a jamais pu quitter Hexa. Tu peux être le premier.",
  ],
  interstellaire: [
    "Tu as quitté Hexa. Akhena Pink écrivait qu'ils ne savaient pas s'ils pourraient un jour en repartir. Toi, tu l'as fait.",
    "Le saut nédrolytique use le cœur de conversion. Bryan notait la moindre anomalie de fréquence : fais pareil.",
    "Le système PXT : c'est autour de PXT-1 que tourne la station Hexa-Zéro, là où tu as été formé. Je n'ai plus aucun signal d'elle.",
  ],
  colonisation: [
    "Un seul monde ne suffit pas à sauver une espèce. C'était la mission du Traveler-98 : trouver un second foyer.",
    "Stations, cargos, colonies : à toi de faire ce qu'ils n'ont pas pu finir.",
    "Pour l'avenir de l'humanité, cadet.",
  ],
  signal: [
    "Il reste une chose que l'équipage du Traveler-98 n'a jamais pu faire : prévenir la Terre.",
    "Leur antenne est encore dans l'épave. Avec une balise interstellaire et assez de courant, leur message peut enfin partir.",
  ],
};

// Attente entre deux conseils (secondes)
const COOLDOWN = { often: 150, some: 420 };
export const ADVICE_LEVELS = [['often', 'Souvent'], ['some', 'Parfois'], ['off', 'Jamais']];

export class Progress {
  // game : { player, survival, world, industry, tracks, trains, structs, flight, hotbar(), keyName(a),
  //   visible(), blip(done), toast(t), advice() -> 'often'|'some'|'off', seed() }
  constructor(game) {
    this.game = game;
    this.on = false;
    this.done = new Set();
    this.placed = new Set();
    this.open = true;
    this.el = document.createElement('div');
    this.el.id = 'prog';
    this.el.hidden = true;
    this.el.innerHTML = `<div id="prog-box"><div class="pg-head"><span class="pg-tier"></span><span class="pg-key"></span></div><div class="pg-name"></div><ul class="pg-list"></ul></div>
      <div id="prog-talk" class="off"><div class="tt-face"><span>ORA</span></div><div class="tt-text"></div></div>`;
    document.body.appendChild(this.el);
    this.box = this.el.querySelector('#prog-box');
    this.ui = {
      tier: this.el.querySelector('.pg-tier'), key: this.el.querySelector('.pg-key'),
      name: this.el.querySelector('.pg-name'), list: this.el.querySelector('.pg-list'),
      talk: this.el.querySelector('#prog-talk'), text: this.el.querySelector('#prog-talk .tt-text'),
    };
    this.lines = [];
    this.line = null;
  }

  // state : { done: [ 'tier.objectif', … ], placed: [...], open } (ou rien : nouveau monde)
  start(state) {
    this.on = true;
    this.done = new Set(Array.isArray(state?.done) ? state.done.filter((s) => typeof s === 'string') : []);
    this.placed = new Set(Array.isArray(state?.placed) ? state.placed.filter((s) => typeof s === 'string') : []);
    this.rails = Number.isFinite(state?.rails) ? state.rails : 0; // (rails de train posés par le joueur)
    this.open = state?.open !== false;
    this.tier = this.currentTier();
    this.clock = 0;
    this.adviceT = 90; // (pas de conseil dans la première minute et demie)
    this.stuck = 0;
    this.said = new Map(); // (conseil -> dernière fois qu'il a été dit, en secondes de jeu)
    this.time = 0;
    this.lines = [];
    this.line = null;
    this.ui.talk.classList.add('off');
    this.first = true; // (premier contrôle : ce qui est déjà fait se valide sans fanfare)
    this.render(false);
  }

  stop() {
    this.on = false;
    this.el.hidden = true;
    this.lines = [];
    this.line = null;
  }

  save() {
    return { done: [...this.done], placed: [...this.placed], rails: this.rails, open: this.open };
  }

  toggle() {
    if (!this.on) return;
    this.open = !this.open;
    this.render(false);
  }

  // Le jeu signale un bloc posé (bois, établi, four, nédrolytium)
  event(type, id) {
    if (!this.on || (type !== 'place' && type !== 'signal')) return;
    if (type === 'signal') { this.placed.add('signal'); return; }
    if (isLog(id)) this.placed.add('log');
    if (id === CRAFTING_TABLE) this.placed.add('table');
    if (isFurnace(id)) this.placed.add('furnace');
    if (id === NEDROLYTIUM) this.placed.add('ned');
    if (BLOCKS[id]?.track !== undefined) this.rails++;
  }

  currentTier() {
    const i = TIERS.findIndex((t) => t.goals.some((g) => !this.done.has(t.id + '.' + g.id)));
    return i < 0 ? TIERS.length : i;
  }

  // ---------- Affichage ----------
  render(pop) {
    const T = TIERS[this.tier];
    const key = this.game.keyName?.('objectives');
    this.ui.key.textContent = key ? `[${key}]` : '';
    if (!T) {
      this.ui.tier.textContent = translate('Tiers technologiques');
      this.ui.name.textContent = translate('Tous les tiers sont terminés');
      this.ui.list.innerHTML = '';
    } else {
      this.ui.tier.textContent = `${translate('Tier')} ${this.tier + 1} / ${TIERS.length}`;
      this.ui.name.textContent = translate(T.name);
      this.ui.list.innerHTML = T.goals.map((g) => {
        const ok = this.done.has(T.id + '.' + g.id);
        return `<li class="${ok ? 'ok' : ''}" data-g="${g.id}"><i></i><span>${esc(translate(g.goal))}</span><b></b></li>`;
      }).join('');
    }
    this.box.classList.toggle('closed', !this.open);
    if (pop) { this.box.classList.remove('pop'); void this.box.offsetWidth; this.box.classList.add('pop'); }
  }

  // ---------- Chaque image ----------
  update(dt) {
    if (!this.on) return;
    const vis = this.game.visible();
    this.el.hidden = !vis;
    if (!vis) return;
    this.time += dt;
    this.updateTalk(dt);
    if ((this.clock -= dt) > 0) return;
    this.clock = 0.5;
    const ctx = this.context();
    let changed = false, newly = null, top = -1;
    // (tous les tiers : un ancien monde, ou un joueur qui saute des étapes, valide ce qu'il a)
    TIERS.forEach((T, ti) => {
      for (const g of T.goals) {
        const k = T.id + '.' + g.id;
        if (this.done.has(k)) continue;
        let r;
        try { r = g.check(ctx); } catch { r = false; }
        if (r === true) { this.done.add(k); changed = true; if (!T.final) top = Math.max(top, ti); if (!newly) newly = g; }
        else if (ti === this.tier) {
          const li = this.ui.list.querySelector(`li[data-g="${g.id}"] b`);
          if (li) li.textContent = typeof r === 'string' ? r : '';
        }
      }
    });
    // (un objectif d'un tier atteint : ceux des tiers d'avant le sont forcément)
    for (let ti = 0; ti < top; ti++) for (const g of TIERS[ti].goals) this.done.add(TIERS[ti].id + '.' + g.id);
    if (changed) {
      const was = this.tier;
      this.tier = this.currentTier();
      const quiet = this.first;
      this.render(this.tier !== was && !quiet);
      if (!quiet) {
        this.stuck = 0;
        if (this.tier !== was) {
          this.game.blip(true);
          if (this.tier < TIERS.length) {
            this.game.toast(`${translate('Tier')} ${this.tier + 1} : ${translate(TIERS[this.tier].name)}`);
            this.say(GREET[TIERS[this.tier].id]);
          } else this.game.toast(translate('Tous les tiers technologiques sont terminés !'));
        } else if (newly) {
          this.game.blip(false);
          this.game.toast(`${translate('Objectif atteint')} : ${translate(newly.goal)}`);
        }
      }
    }
    this.first = false;
    this.advise(ctx, 0.5);
  }

  context() {
    const g = this.game, sv = g.survival, p = g.player, rails = this.rails;
    const ids = () => {
      if (sv.on) { const out = sv.slots.filter(Boolean).map((s) => s.id); if (sv.cursor) out.push(sv.cursor.id); return out; }
      return (g.hotbar() || []).filter(Boolean);
    };
    const count = (id) => {
      if (!sv.on) return ids().includes(id) ? 1 : 0;
      let n = 0;
      for (const s of sv.slots) if (s?.id === id) n += s.n;
      if (sv.cursor?.id === id) n += sv.cursor.n;
      return n;
    };
    const ind = g.industry;
    return { rails,
      player: p, flight: g.flight, structs: g.structs, trains: g.trains, tracks: g.tracks, ind, placed: this.placed,
      count, has: (f) => ids().some(f),
      hasNode: (id) => { for (const v of ind.nodes.values()) if (v === id) return true; return false; },
      fuel: () => { if (ind.fdirty) ind.rebuildFluids(); let n = 0; for (const net of ind.fnets || []) if (net.f === 'fuel') n += net.n; return n; },
      headId: () => sv.head?.id || 0,
      orbital: g.orbital,
      beacon: () => !!g.beaconInWreck?.(),
      // (villageois vivants sur un autre astre que Hexa)
      colonists: () => (g.animals?.list || []).filter((a) => a.type === 'villager' && !a.dead && zoneOfXZ(a.pos.x, a.pos.z) > 0).length,
      system: () => {
        const F = g.flight;
        if (F.zone >= 0) return systemOf(zoneBody(F.zone))?.id;
        const B = F.bubbleAt?.(p.pos.x, p.pos.z);
        if (!B) return null;
        F.toAbs(B, p.pos, _v);
        return systemNear(_v, F.day, g.seed())?.id;
      },
    };
  }

  // ---------- Conseils d'ORA ----------
  // Rares, selon la situation ; le plus souvent : l'objectif où l'on bloque
  advise(ctx, dt) {
    const lvl = this.game.advice();
    if (lvl === 'off' || this.line || this.lines.length) return;
    this.stuck += dt;
    if ((this.adviceT -= dt) > 0) return;
    const g = this.game, sv = g.survival, p = ctx.player;
    const can = (id, every) => this.time - (this.said.get(id) ?? -1e9) > every;
    let pick = null;
    if (sv.on && sv.hunger <= 6 && can('faim', 300)) pick = ['faim', 'Ton énergie baisse. Mange quelque chose avant de repartir.'];
    else if (sv.on && g.night() && !ctx.has((id) => id === TORCH) && ctx.count(COAL) > 0 && can('nuit', 900)) pick = ['nuit', 'Il fait nuit. Avec ton charbon, tu peux fabriquer des torches.'];
    else if (p.pilot && !p.pilot.passenger && g.rocketFuel?.(p.pilot.s) < 0.15 && can('carbu', 240)) pick = ['carbu', '!Les réservoirs de la fusée sont presque vides.'];
    else if (ctx.ind.nets.some((n) => n.users.length && n.demand > 0 && n.ratio < 0.6) && can('courant', 600)) pick = ['courant', 'Un de tes réseaux manque de courant : ajoute un générateur ou une batterie.'];
    else {
      const T = TIERS[this.tier];
      const goal = T?.goals.find((x) => !this.done.has(T.id + '.' + x.id));
      if (goal && this.stuck > 240 && can('obj.' + goal.id, 600)) pick = ['obj.' + goal.id, goal.hint];
    }
    if (!pick) { this.adviceT = 20; return; }
    this.said.set(pick[0], this.time);
    this.say([pick[1]]);
    this.adviceT = COOLDOWN[lvl] || COOLDOWN.some;
  }

  // ---------- Répliques (comme le tutoriel) ----------
  fmt(text) {
    return String(text).replace(/\{(k:)?(\w+)\}/g, (m, kb, a) => this.game.keyName?.(a) || (a.length === 1 ? a : m));
  }
  say(lines) {
    if (lines) for (const text of lines) this.lines.push(text);
  }
  updateTalk(dt) {
    if (!this.line && this.lines.length) {
      let text = this.fmt(translate(this.lines.shift())), alert = false;
      if (text.startsWith('!')) { alert = true; text = text.slice(1); }
      this.line = { text, shown: 0, hold: 2 + text.length / 25, t: 0 };
      this.ui.talk.classList.remove('off');
      this.ui.talk.classList.toggle('alert', alert);
      this.game.blip(false);
    }
    const L = this.line;
    if (!L) return;
    L.t += dt;
    if (L.shown < L.text.length) {
      L.shown = Math.min(L.text.length, L.shown + dt * 62);
      this.ui.text.textContent = L.text.slice(0, Math.floor(L.shown));
      if (L.shown >= L.text.length) L.t = 0;
      return;
    }
    if (L.t > L.hold) {
      this.line = null;
      if (!this.lines.length) this.ui.talk.classList.add('off');
    }
  }
}

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
