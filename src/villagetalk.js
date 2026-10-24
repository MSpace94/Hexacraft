// Langue et mémoire des villageois.
//  - Ils parlent leur langue (PHRASES) : entre eux (discussions) et dans certaines situations
//    (un joueur approche, on les frappe, on commerce avec eux). On n'affiche rien : on les
//    entend (onSay -> le son).
//  - Chaque villageois se souvient de chaque joueur (a.mem : pseudo -> avis, de -100 à 100),
//    même après une déconnexion ou un rechargement (c'est sauvegardé avec lui).
//  - Les nouvelles circulent : quand deux villageois discutent, celui qui a un avis tranché
//    sur un joueur en parle à l'autre, qui le croit un peu. Frapper un villageois devant
//    témoins, c'est tout le village qui finit par le savoir.
//  - L'avis change leur comportement : un ami a de meilleurs prix, un joueur dont on se méfie
//    paie plus cher, un joueur qui fait peur voit les villageois s'enfuir et refuser de
//    commercer. Avec le temps, ils pardonnent (lentement, et très lentement une vraie rancune).
//  - Un cadeau (accroupi + clic droit sur un villageois, l'objet tenu) se fait pardonner plus
//    vite : il va à la mairie et tout le village l'apprend. Accroupi avec un objet en main, on
//    peut approcher même un villageois qui a peur de nous.
// L'hôte décide de tout ; les clients reçoivent ce qu'on dit ('vsay') et l'avis des villageois
// proches sur eux ('vrep').

// clé -> [langue des villageois, français]
export const PHRASES = {
  // vie du village
  hello: ['Moa !', 'Bonjour !'], hi: ['Hé !', 'Salut !'], come: ['Va !', 'Viens !'], leave: ['Na va !', 'Pars !'],
  wait: ['Ho, ho !', 'Attends !'], look: ['Ha !', 'Regarde !'], listen: ['Mmm, ha !', 'Écoute !'],
  thanks: ['Si !', 'Merci !'], welcome: ['Ya !', 'De rien !'], bye: ['Moa va !', 'À bientôt !'],
  friend: ['Mi !', 'Ami !'], stranger: ['No-mi !', 'Étranger !'], greet: ['Moa-va !', 'Bienvenue !'],
  // travail
  working: ['Mi ta', 'Je travaille'], towork: ['Ta ! Ta !', 'Au travail !'], farm: ['Va fa !', 'Va à la ferme'],
  harvest: ['Fa nom !', 'Récolte le blé'], plant: ['Pa si !', 'Plante les graines'], wood: ['Bo ta !', 'Coupe le bois'],
  stone: ['Ka ha !', 'Cherche de la pierre'], iron: ['Fe va !', 'Apporte le fer'], done: ['Ta fin !', 'J\'ai fini'],
  tired: ['Mmm... no ta.', 'Je suis fatigué'],
  salute: ['Maroha !', 'À vos ordres !'], pass: ['Vashoru !', 'Passez !'], stop: ['Kradom !', 'Stop, attendez !'], slow: ['Lomashi !', 'Ralentissez !'],
  clearpad: ['Sharavok !', 'Dégagez la piste !'], move: ['Movara !', 'Circulez !'],
  // commerce
  want: ['Ha, mi ?', 'Que veux-tu ?'], buy: ['Mi buy.', 'Je veux acheter'], price: ['Ko ?', 'Combien ?'],
  dear: ['Ko ! Na !', 'Trop cher !'], fair: ['Ko ya !', 'Bon prix !'], give: ['Da mi !', 'Donne-moi ça'],
  here: ['Ha, da !', 'Tiens'], emerald: ['Si mé !', 'Merci pour l\'émeraude'], deal: ['Ya ! Ta !', 'Marché conclu !'],
  tomorrow: ['Va dara !', 'Reviens demain'],
  // danger
  careful: ['Ha !', 'Attention !'], danger: ['Ra !', 'Danger !'], monster: ['Gro !', 'Un monstre !'],
  zombie: ['Zo !', 'Un zombie !'], skeleton: ['Ska !', 'Un squelette !'], coming: ['Va ! Va !', 'Ils arrivent !'],
  run: ['Ra-va !', 'Courez !'], door: ['Do ! Do !', 'Fermez la porte !'], help: ['Mi ! Mi !', 'Aidez-nous !'],
  defend: ['Va-ra !', 'Défendez le village !'], risky: ['Ra no !', 'C\'est dangereux !'], fine: ['Ya, ya !', 'Tout va bien !'],
  // maison
  myhome: ['Mi do', 'Ma maison'], ourhome: ['No do', 'Notre maison'], enter: ['Va do', 'Entre'], out: ['No do !', 'Sors'],
  close: ['Do ka !', 'Ferme la porte'], open: ['Do ou !', 'Ouvre la porte'], sleep: ['Va do !', 'Va dormir'],
  night: ['Nora !', 'Il fait nuit'], day: ['Dara !', 'Il fait jour'], seeyou: ['Dara va !', 'À demain'],
};
export const PHRASE_KEYS = Object.keys(PHRASES);

// Discussions : les répliques alternent entre les deux villageois (A, B, A, B...)
const TALKS = {
  day: [
    ['hello', 'hi', 'friend'],
    ['hi', 'hello', 'listen', 'look'],
    ['towork', 'working', 'thanks', 'welcome'],
    ['farm', 'harvest', 'towork'],
    ['plant', 'working', 'done', 'thanks'],
    ['wood', 'wait', 'working', 'done'],
    ['stone', 'iron', 'here', 'thanks'],
    ['tired', 'myhome', 'bye'],
    ['want', 'buy', 'price', 'dear', 'fair', 'deal'],
    ['give', 'price', 'fair', 'here', 'thanks'],
    ['look', 'ourhome', 'friend'],
  ],
  morning: [
    ['day', 'hello', 'towork'],
    ['day', 'out', 'farm', 'towork'],
  ],
  evening: [
    ['done', 'tired', 'sleep'],
    ['night', 'sleep', 'seeyou'],
    ['night', 'close', 'seeyou'],
  ],
  night: [
    ['night', 'enter', 'close'],
    ['listen', 'wait', 'fine'],
    ['night', 'risky', 'sleep', 'seeyou'],
  ],
};
// ... et quand l'un d'eux parle d'un joueur (rumeur)
const GOSSIP_BAD = [['listen', 'stranger', 'danger', 'careful'], ['look', 'monster', 'risky', 'door'], ['listen', 'stranger', 'leave', 'defend']];
const GOSSIP_GOOD = [['listen', 'friend', 'fair', 'thanks'], ['look', 'friend', 'greet', 'welcome']];

// Avis (de -100 à 100) : ce qui le fait bouger
const HIT_VICTIM = -35;      // frappé
const HIT_SEEN = -20;        // a vu frapper un villageois
const KILL_SEEN = -60;       // a vu tuer un villageois
const TRADE_DONE = 6;        // un échange avec lui
const TRADE_SEEN = 2;        // a vu un échange
const ALARM = -6;            // a entendu un villageois crier en voyant ce joueur
const GIFT_VILLAGE = 0.5;    // un cadeau : tout le village de celui qui le reçoit l'apprend (la moitié)...
const GIFT_SEEN = 0.3;       // ... et ceux d'ailleurs qui ont vu la scène, un peu
const SEE_R = 16;            // on voit ce qui se passe jusqu'à SEE_R blocs
const BELIEF = 0.6;          // une rumeur : on rapproche son avis de celui qu'on entend...
const HEARSAY = 0.8;         // ... sans jamais dépasser 80 % de l'avis de celui qui raconte
const FORGIVE = 1 / 60;      // points d'avis oubliés par seconde de jeu...
const GRUDGE = 1 / 240;      // ... 4 fois moins vite pour une vraie rancune (sous AFRAID) :
                             // tuer un villageois devant témoins se paie pendant des heures
// Seuils : à partir de là, il a peur / se méfie / est un ami
export const AFRAID = -50, WARY = -20, FRIEND = 30;

const TALK_R = 5;            // deux villageois à moins de TALK_R blocs peuvent discuter
const LOOK_EVERY = 1;        // secondes entre deux recherches de partenaire
const START_CHANCE = 0.2;    // chance qu'une discussion commence (par villageois, par recherche)
const LINE_TIME = 1.7;       // secondes entre deux répliques
const QUIET = [18, 40];      // repos entre deux discussions (secondes, min-max)
const HELLO_R = 4;           // salue un joueur qui approche...
const FEAR_R = 10;           // ... mais s'enfuit dès FEAR_R blocs devant un joueur qui fait peur
const HELLO_AGAIN = 60;      // au plus une fois par minute (par joueur)
const FEAR_AGAIN = 6;
const TURN = 5;

const rnd = (a, b) => a + Math.random() * (b - a);
const pickOf = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (v) => Math.max(-100, Math.min(100, v));
const key = (name) => String(name || '').toLowerCase().slice(0, 24);

// Moment de la journée (0 = lever du soleil, 0.5 = coucher)
function period(t) {
  if (t < 0.07) return 'morning';
  if (t < 0.43) return 'day';
  if (t < 0.52) return 'evening';
  return 'night';
}

// Humeur d'un avis : 'afraid', 'wary', 'friend' ou 'neutral' (un enfant a peur plus vite)
export function moodOf(op, child = false) {
  if (op <= (child ? WARY : AFRAID)) return 'afraid';
  if (op <= WARY) return 'wary';
  if (op >= FRIEND) return 'friend';
  return 'neutral';
}

export class VillageTalk {
  constructor(animals, species) {
    this.animals = animals;
    this.species = species;
    this.talks = [];          // discussions en cours { a, b, lines, i, t, about }
    this.pending = [];        // répliques différées { a, key, t }
    this.lookClock = 0;
    this.time = () => 0.1;    // heure du jour (remplacée par le jeu)
    this.nameOf = () => '';   // pseudo d'un joueur (remplacé par le jeu)
    this.onSay = null;        // (villageois, clé) : un villageois parle
    this.remoteOp = new Map(); // client : avis des villageois proches sur nous (id -> avis)
  }

  isVillager(a) { return a && !a.dead && this.species[a.type]?.villager; }
  villagers() { return this.animals.list.filter((a) => this.isVillager(a)); }

  // ---------- Mémoire ----------
  // Avis de ce villageois sur ce joueur (client : celui reçu de l'hôte, sur nous)
  opinion(a, name) {
    if (this.animals.remote) return this.remoteOp.get(a.id) || 0;
    return a.mem?.[key(name)] || 0;
  }
  mood(a, name) { return moodOf(this.opinion(a, name), a.type === 'villager_child'); }

  change(a, name, d) {
    const k = key(name);
    if (!k || !this.isVillager(a)) return;
    a.mem ||= {};
    a.mem[k] = clamp((a.mem[k] || 0) + d);
  }

  // Ceux qui voient la scène (à moins de SEE_R blocs de `at`)
  witnesses(at, except) {
    return this.villagers().filter((b) => b !== except && Math.hypot(b.pos.x - at.pos.x, b.pos.z - at.pos.z) < SEE_R && Math.abs(b.pos.y - at.pos.y) < 6);
  }

  // Un villageois parle (le jeu le fait entendre ; l'hôte l'envoie aux autres)
  say(a, k) {
    if (a && PHRASES[k]) this.onSay?.(a, k);
  }
  later(a, k, delay) { this.pending.push({ a, key: k, t: delay }); }

  // ---------- Hôte ----------
  tick(dt, players) {
    for (const p of this.pending) p.t -= dt;
    for (const p of this.pending.filter((p) => p.t <= 0)) if (this.isVillager(p.a)) this.say(p.a, p.key);
    this.pending = this.pending.filter((p) => p.t > 0);

    const all = this.villagers();
    // le temps efface (lentement) les rancunes comme les amitiés
    for (const a of all) {
      if (!a.mem) continue;
      for (const k in a.mem) {
        const v = a.mem[k], f = (v < AFRAID ? GRUDGE : FORGIVE) * dt;
        a.mem[k] = Math.abs(v) <= f ? 0 : v - Math.sign(v) * f;
        if (!a.mem[k]) delete a.mem[k];
      }
    }

    const list = all.filter((a) => a.active);
    for (const a of list) {
      if (a.quiet === undefined) a.quiet = rnd(3, QUIET[1]);
      a.quiet -= dt;
      a.seen ||= {};
      for (const k in a.seen) if ((a.seen[k] -= dt) <= 0) delete a.seen[k];
      for (const p of players) this.meet(a, p);
    }

    // discussions en cours
    for (const c of this.talks) {
      const ok = [c.a, c.b].every((v) => this.isVillager(v) && v.state === 'talk' && v.talkWith);
      if (!ok) { c.over = true; continue; }
      for (const [v, w] of [[c.a, c.b], [c.b, c.a]]) this.face(v, w, dt);
      c.t -= dt;
      if (c.t > 0) continue;
      if (c.i >= c.lines.length) { this.gossip(c); c.over = true; continue; }
      this.say(c.i % 2 ? c.b : c.a, c.lines[c.i++]);
      c.t = LINE_TIME + rnd(-0.3, 0.4);
    }
    for (const c of this.talks.filter((c) => c.over)) this.end(c);
    this.talks = this.talks.filter((c) => !c.over);

    // nouvelles discussions
    this.lookClock -= dt;
    if (this.lookClock > 0) return;
    this.lookClock = LOOK_EVERY;
    for (const a of list) {
      if (!this.free(a) || Math.random() > START_CHANCE) continue;
      const b = list.find((b) => b !== a && this.free(b) && Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) < TALK_R && Math.abs(b.pos.y - a.pos.y) < 2);
      if (b) this.start(a, b);
    }
  }

  // Un joueur passe près d'un villageois : il le salue... ou s'enfuit
  meet(a, p) {
    const name = this.nameOf(p), k = key(name);
    if (!k || a.seen[k] || a.state === 'panic') return;
    const dx = a.pos.x - p.pos.x, dz = a.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    if (Math.abs(p.pos.y - a.pos.y) > 4) return;
    const mood = this.mood(a, name);
    // (accroupi, un objet à la main : il vient offrir quelque chose, on l'attend)
    if (mood === 'afraid' && p.sneak && p.held) {
      if (d < FEAR_R) { a.seen[k] = FEAR_AGAIN; if (!a.talkWith) this.say(a, 'wait'); }
      return;
    }
    if (mood === 'afraid' && d < FEAR_R) {
      a.seen[k] = FEAR_AGAIN;
      if (a.talkWith) this.stop(a);
      this.say(a, pickOf(['stranger', 'danger', 'run', 'monster']));
      this.animals.flee(a, dx / (d || 1), dz / (d || 1), 4);
      // ses cris alertent ceux qui l'entendent : ils se méfient un peu plus
      for (const b of this.witnesses(a, a)) {
        this.change(b, name, ALARM);
        (b.seen ||= {})[k] = HELLO_AGAIN; // (il ne va pas saluer celui qu'on vient de lui signaler)
        if (Math.random() < 0.4) this.later(b, pickOf(['careful', 'door', 'help']), rnd(0.5, 1.5));
      }
      return;
    }
    if (d >= HELLO_R) return;
    a.seen[k] = HELLO_AGAIN;
    if (a.talkWith) return;
    const night = period(this.time()) === 'night';
    const say = {
      wary: ['stranger', 'leave', 'wait'],
      friend: ['friend', 'greet', 'come'],
      neutral: night ? ['stranger', 'hi'] : ['hello', 'hi', 'greet'],
    }[mood];
    this.say(a, pickOf(say));
  }

  free(a) { return !a.talkWith && a.quiet <= 0 && (a.state === 'idle' || a.state === 'walk'); }

  // Début d'une discussion : s'il a un avis tranché sur un joueur que l'autre ignore, il en
  // parle (rumeur) ; sinon on parle du travail, de la journée...
  start(a, b) {
    let about = null, best = 19;
    for (const k in a.mem || {}) {
      const v = a.mem[k], w = b.mem?.[k] || 0;
      if (Math.abs(v) > best && Math.abs(v * HEARSAY - w) > 10) { best = Math.abs(v); about = k; }
    }
    const lines = about ? pickOf(a.mem[about] < 0 ? GOSSIP_BAD : GOSSIP_GOOD) : pickOf(TALKS[period(this.time())]);
    for (const [v, w] of [[a, b], [b, a]]) {
      v.talkWith = w;
      v.state = 'talk';
      v.target = null;
      v.timer = 999;
    }
    this.talks.push({ a, b, lines, i: 0, t: 0.4, about });
  }

  // Fin d'une rumeur : celui qui écoute rapproche son avis de celui qu'il a entendu
  gossip(c) {
    if (!c.about) return;
    const told = c.a.mem?.[c.about] || 0, target = told * HEARSAY;
    const had = c.b.mem?.[c.about] || 0;
    if (Math.abs(target) <= Math.abs(had) && Math.sign(target) === Math.sign(had)) return;
    c.b.mem ||= {};
    c.b.mem[c.about] = clamp(had + (target - had) * BELIEF);
  }

  stop(a) {
    const c = this.talks.find((c) => c.a === a || c.b === a);
    if (c) c.over = true;
  }

  end(c) {
    for (const v of [c.a, c.b]) {
      v.talkWith = null;
      v.quiet = rnd(QUIET[0], QUIET[1]);
      if (v.state === 'talk') { v.state = 'idle'; v.timer = 1 + Math.random() * 2; }
    }
  }

  face(a, b, dt) {
    const want = Math.atan2(-(b.pos.x - a.pos.x), -(b.pos.z - a.pos.z));
    let d = want - a.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    a.yaw += Math.max(-TURN * dt, Math.min(TURN * dt, d));
    a.headTarget = 0;
  }

  // Un villageois est frappé (by : pseudo du joueur, s'il y en a un) : il crie, il s'en
  // souvient ; ceux qui ont vu aussi, et ils appellent à l'aide... puis se rassurent
  hurt(a, by) {
    if (!this.species[a.type]?.villager) return;
    if (by) this.change(a, by, HIT_VICTIM);
    this.say(a, a.dead ? 'help' : pickOf(['danger', 'help', 'careful']));
    let n = 0;
    for (const b of this.witnesses(a, a)) {
      if (by) this.change(b, by, a.dead ? KILL_SEEN : HIT_SEEN);
      if (n++ >= 3) continue;
      this.later(b, a.dead ? 'risky' : pickOf(['run', 'defend', 'danger', 'help']), rnd(0.4, 1.2));
      if (!by || this.mood(b, by) !== 'afraid') this.later(b, 'fine', rnd(9, 13));
    }
  }

  // Un échange conclu avec ce joueur : il est content, ceux qui ont vu aussi (un peu)
  traded(a, name) {
    if (!this.isVillager(a)) return;
    this.change(a, name, TRADE_DONE);
    for (const b of this.witnesses(a, a)) this.change(b, name, TRADE_SEEN);
  }

  // Un cadeau de ce joueur (gain : selon sa valeur) : celui qui le reçoit est content, son
  // village l'apprend (le cadeau va à la mairie), ceux qui ont vu aussi
  gifted(a, name, gain, village = []) {
    if (!this.isVillager(a)) return;
    this.change(a, name, gain);
    const told = new Set([a]);
    for (const b of village) if (!told.has(b)) { told.add(b); this.change(b, name, gain * GIFT_VILLAGE); }
    for (const b of this.witnesses(a, a)) if (!told.has(b)) { told.add(b); this.change(b, name, gain * GIFT_SEEN); }
    if (a.talkWith) this.stop(a);
    this.say(a, this.mood(a, name) === 'friend' ? pickOf(['friend', 'thanks']) : 'thanks');
    const near = this.witnesses(a, a);
    if (near.length) this.later(pickOf(near), pickOf(['thanks', 'fine', 'welcome']), rnd(0.8, 1.6));
  }

  // Hôte : avis des villageois proches de ce joueur sur lui [[id, avis]] (pour un client)
  report(p, name) {
    const k = key(name), out = [];
    for (const a of this.villagers()) {
      const v = Math.round(a.mem?.[k] || 0);
      if (v && Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) < 48) out.push([a.id, v]);
    }
    return out;
  }

  // Client : avis reçus de l'hôte
  applyReport(list) {
    this.remoteOp.clear();
    for (const e of list) if (Array.isArray(e) && Number.isFinite(e[0]) && Number.isFinite(e[1])) this.remoteOp.set(e[0], clamp(e[1]));
  }

  clear() {
    this.talks = [];
    this.pending = [];
    this.remoteOp.clear();
  }
}

// Mémoire d'un villageois pour la sauvegarde : seulement les avis qui comptent, arrondis
export function packMemory(mem) {
  const out = {};
  for (const k in mem || {}) if (Math.abs(mem[k]) >= 1) out[k] = Math.round(mem[k]);
  return Object.keys(out).length ? out : null;
}
export function unpackMemory(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  const out = {};
  for (const k of Object.keys(m).slice(0, 64)) if (Number.isFinite(m[k])) out[key(k)] = clamp(m[k]);
  return out;
}
