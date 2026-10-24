// Coffres et fours : ce que contient chaque bloc, rangé par position "q,r,y" (sauvegardé
// avec le monde), ou "S<id>:q,r,y" pour ceux posés sur un objet physique (coordonnées dans
// l'objet ; le contenu suit l'objet quand on l'assemble ou qu'on le repose, voir structs.js). Le four cuit tout seul, même quand on ne le regarde pas : il brûle son
// combustible, fond ce qu'on y a mis, et s'allume / s'éteint (le bloc change de variante).
import { BLOCKS, ITEMS, FURNACE, FURNACE_ON, isFurnace, makeSlot } from './blocks.js?v=1.1.5-alpha-mvm2b95g';

export const CHEST_SLOTS = 30;
export const COOK_TIME = 5; // secondes pour fondre un objet

// Ce qui fond au four : entrée -> résultat
export const SMELT = {
  8: 40,    // sable -> verre
  28: 3,    // pierre taillée -> pierre
  5: 104,   // bûche de chêne -> charbon (de bois)
  97: 104,  // bûche de châtaignier -> charbon (de bois)
  152: 104, // bûche de tilleul -> charbon (de bois)
  256: 104, // bûche de bouleau -> charbon (de bois)
  122: 325, // lingot de fer -> lingot chaud (à marteler en fer industriel)
  163: 164, // côtelette de porc crue -> cuite
  428: 429, // gigot de mouton cru -> cuit
  430: 431, // viande de renard crue -> cuite
  441: 442, // pomme de terre -> cuite
  60: 122,  // minerai de fer -> lingot de fer
  83: 130,  // minerai de platine -> lingot de platine
  85: 131,  // minerai de tungstène -> lingot de tungstène
  640: 644, // minerai de fluorite -> lingot de fluorite
  642: 645, // minerai de cramoisite -> lingot de cramoisite
  603: 623, // argile -> briques rouges
  631: 606, // briques de pierre -> fissurées
  2: 605,   // terre -> terre craquelée
};
// Combustibles : durée de combustion (secondes). Un charbon cuit 8 objets.
export const FUEL = {
  104: 40,  // charbon
  5: 7.5,   // bûche
  18: 7.5,  // planches
  97: 7.5,  // bûche de châtaignier
  99: 7.5,  // planches de châtaignier
  146: 2.5, // bâton de châtaignier
  152: 7.5, // bûche de tilleul
  154: 7.5, // planches de tilleul
  157: 2.5, // bâton de tilleul
  31: 7.5,  // table de craft
  33: 3.75, // dalle de chêne
  103: 2.5, // bâton
  256: 7.5, // bûche de bouleau
  258: 7.5, // planches de bouleau
  300: 2.5, // bâton de bouleau
  323: 200, // charbon de forge (4 charbons tassés : brûle plus longtemps)
};

const stackMax = (id) => ITEMS[id]?.stack ?? 64;
const key = (q, r, y) => q + ',' + r + ',' + y;

export function empty(type) {
  return type === 'chest'
    ? { type, slots: new Array(CHEST_SLOTS).fill(null) }
    : { type, input: null, fuel: null, output: null, burn: 0, burnMax: 0, cook: 0 };
}

export class Containers {
  constructor(world) {
    this.world = world;
    this.map = new Map(); // "q,r,y" ou "S<id>:q,r,y" -> contenu
    this.structs = null;  // objets physiques (voir main.js)
  }

  // Contenu désigné par sa clé ("q,r,y" ou "S<id>:q,r,y"), créé vide au besoin, ou null
  byKey(k) {
    if (typeof k !== 'string') return null;
    // (T<id> : le coffre d'un wagon de train, voir trains.js)
    if (k[0] === 'T') return this.trainBox?.(Number(k.slice(1))) || null;
    if (k[0] === 'S') {
      const [sid, lk] = k.slice(1).split(':');
      const s = this.structs?.byId(Number(sid));
      return s && lk ? this.atStruct(s, lk) : null;
    }
    const v = k.split(',').map(Number);
    return v.length === 3 && v.every(Number.isInteger) ? this.at(v[0], v[1], v[2]) : null;
  }

  // ---------- En ligne ----------
  // Ce qu'on envoie d'un coffre / four (copie)
  data(c) {
    const cp = (s) => (s ? makeSlot(s.id, s.n, s.w) : null);
    if (c.type === 'chest') return { type: 'chest', slots: c.slots.map(cp) };
    return { type: 'furnace', input: cp(c.input), fuel: cp(c.fuel), output: cp(c.output), burn: c.burn, burnMax: c.burnMax, cook: c.cook };
  }

  // Applique dans c un contenu reçu (vérifié). progress : reprendre aussi le feu et la cuisson
  // (venant de l'hôte ; un joueur ne fait que déplacer des objets)
  apply(c, d, progress) {
    if (!c || !d || d.type !== c.type) return false;
    const ok = (s) => (s && Number.isInteger(s.id) && (BLOCKS[s.id] || ITEMS[s.id]) && Number.isInteger(s.n) && s.n > 0 ? makeSlot(s.id, Math.min(s.n, stackMax(s.id)), s.w) : null);
    if (c.type === 'chest') {
      if (!Array.isArray(d.slots)) return false;
      for (let i = 0; i < CHEST_SLOTS; i++) c.slots[i] = ok(d.slots[i]);
    } else {
      c.input = ok(d.input); c.fuel = ok(d.fuel); c.output = ok(d.output);
      if (progress) {
        c.burn = Number(d.burn) || 0; c.burnMax = Number(d.burnMax) || 0; c.cook = Number(d.cook) || 0;
      }
    }
    return true;
  }

  // Contenu du coffre / four de l'objet s, case locale k (créé vide au besoin), ou null
  atStruct(s, k) {
    const type = BLOCKS[s.blocks.get(k)]?.container;
    if (!type) return null;
    const mk = 'S' + s.id + ':' + k;
    let c = this.map.get(mk);
    if (!c || c.type !== type) { c = empty(type); this.map.set(mk, c); }
    return c;
  }

  // Le contenu change de place (bloc assemblé en objet, reposé dans le monde...)
  move(from, to) {
    const c = this.map.get(from);
    if (!c) return;
    this.map.delete(from);
    this.map.set(to, c);
  }

  // Bloc d'un objet cassé : renvoie son contenu et l'oublie
  takeKey(k) {
    const c = this.map.get(k);
    this.map.delete(k);
    if (!c) return [];
    return (c.type === 'chest' ? c.slots : [c.input, c.fuel, c.output]).filter(Boolean);
  }

  // Contenu du coffre / four en (q, r, y) (créé vide au besoin), ou null si ce n'en est pas un
  at(q, r, y) {
    const type = BLOCKS[this.world.getBlock(q, r, y)]?.container;
    if (!type) return null;
    const k = key(q, r, y);
    let c = this.map.get(k);
    if (!c || c.type !== type) { c = empty(type); this.map.set(k, c); this.onCreate?.(q, r, y, c); } // (coffre des mines : son butin)
    return c;
  }

  // Bloc cassé par le joueur : renvoie ce qu'il contenait ([{ id, n }]) et l'oublie
  take(q, r, y) {
    const k = key(q, r, y), c = this.map.get(k) || (this.onCreate ? this.at(q, r, y) : null); // (jamais ouvert : son butin aussi)
    this.map.delete(k);
    if (!c) return [];
    const list = c.type === 'chest' ? c.slots : [c.input, c.fuel, c.output];
    return list.filter(Boolean);
  }

  // Un bloc du monde a changé : un coffre / four détruit (explosion...) perd son contenu
  onBlockSet(q, r, y, id) {
    const k = key(q, r, y), c = this.map.get(k);
    if (c && BLOCKS[id]?.container !== c.type) this.map.delete(k);
  }

  // Fours : combustion et cuisson. Renvoie les fours dont le contenu a changé.
  update(dt) {
    const changed = [];
    for (const [k, c] of this.map) {
      if (c.type !== 'furnace') continue;
      if (!c.burn && !c.cook && !(c.input && c.fuel)) continue; // rien à faire
      const before = c.burn > 0;
      const out = SMELT[c.input?.id];
      const canSmelt = out !== undefined && (!c.output || (c.output.id === out && c.output.n < stackMax(out)));
      let moved = false;
      if (c.burn > 0) c.burn = Math.max(0, c.burn - dt);
      // plus de feu : on remet du combustible s'il y a quelque chose à cuire
      if (c.burn <= 0 && canSmelt && c.fuel && FUEL[c.fuel.id]) {
        c.burn = c.burnMax = FUEL[c.fuel.id];
        if (--c.fuel.n <= 0) c.fuel = null;
        moved = true;
      }
      if (c.burn > 0 && canSmelt) {
        c.cook += dt;
        if (c.cook >= COOK_TIME) {
          c.cook = 0;
          if (c.output) c.output.n++; else c.output = { id: out, n: 1 };
          if (--c.input.n <= 0) c.input = null;
          moved = true;
        }
      } else {
        // feu éteint ou rien à cuire : la cuisson en cours se perd peu à peu
        c.cook = Math.max(0, c.cook - dt * 2);
      }
      if (c.burn <= 0) c.burnMax = 0;
      const lit = c.burn > 0;
      if (lit !== before) this.setLit(k, lit);
      if (moved) changed.push(c);
    }
    return changed;
  }

  // Allume / éteint le bloc du four (même orientation)
  setLit(k, lit) {
    if (k[0] === 'S') {
      // four d'un objet physique
      const [sid, lk] = k.slice(1).split(':');
      const s = this.structs?.byId(Number(sid)), id = s?.blocks.get(lk);
      if (!isFurnace(id)) return;
      const want = (lit ? FURNACE_ON : FURNACE) + BLOCKS[id].facing;
      if (want !== id) { s.blocks.set(lk, want); this.structs.refresh(s); this.structs.changed(s); }
      return;
    }
    const [q, r, y] = k.split(',').map(Number);
    const id = this.world.getBlock(q, r, y);
    if (!isFurnace(id)) return;
    const want = (lit ? FURNACE_ON : FURNACE) + BLOCKS[id].facing;
    if (want !== id) this.world.setBlock(q, r, y, want);
  }

  // ---------- Sauvegarde ----------
  serialize() {
    const out = [];
    for (const [k, c] of this.map) {
      // (objet disparu ou bloc cassé : contenu oublié)
      if (k[0] === 'S') {
        const [sid, lk] = k.slice(1).split(':');
        if (!BLOCKS[this.structs?.byId(Number(sid))?.blocks.get(lk)]?.container) continue;
      }
      const items = c.type === 'chest' ? c.slots : [c.input, c.fuel, c.output];
      if (!items.some(Boolean) && !c.burn && !c.looted) continue; // vide : inutile de le garder (sauf un coffre de mine vidé)
      out.push([k, c]);
    }
    return out;
  }

  load(list) {
    this.map.clear();
    if (!Array.isArray(list)) return;
    const ok = (s) => (s && (BLOCKS[s.id] || ITEMS[s.id]) && s.n > 0 ? makeSlot(s.id, Math.min(s.n, stackMax(s.id)), s.w) : null);
    for (const e of list) {
      if (!Array.isArray(e) || typeof e[0] !== 'string' || !e[1]) continue;
      const [k, c] = e;
      if (c.type === 'chest') {
        const box = empty('chest');
        (Array.isArray(c.slots) ? c.slots : []).slice(0, CHEST_SLOTS).forEach((s, i) => { box.slots[i] = ok(s); });
        if (c.looted) box.looted = true;
        this.map.set(k, box);
      } else if (c.type === 'furnace') {
        const box = empty('furnace');
        box.input = ok(c.input); box.fuel = ok(c.fuel); box.output = ok(c.output);
        box.burn = Number(c.burn) || 0; box.burnMax = Number(c.burnMax) || box.burn; box.cook = Number(c.cook) || 0;
        this.map.set(k, box);
      }
    }
  }

  clear() { this.map.clear(); }
}
