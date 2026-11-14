// Portes et étanchéité (HexaCraft : lot « étanchéité ») : sas, porte étanche (haut / bas), porte
// électrique, porte holographique, porte hydraulique. Pas de DOM, pas de three.js.
//
// Une porte est un ensemble de blocs de la même sorte qui se touchent (dessus, dessous, les 6
// côtés) : ils s'ouvrent et se ferment ensemble (une porte étanche fait 2 blocs de haut ; une
// porte hydraulique, 2 de large et 3 de haut, ou plus). Fermée, elle est pleine : elle arrête
// l'air (voir orbital.js, flood) et ce qui passe ; ouverte, il n'en reste que le cadre.
//   - Sas, porte étanche : à la main (clic droit). Deux portes de sas proches (SAS_R blocs) ne sont
//     jamais ouvertes en même temps : ouvrir l'une ferme l'autre (l'air de la station reste).
//   - Porte électrique, porte hydraulique : elles suivent le courant (levier, fil, bloc de voltite
//     qui touche l'un de leurs blocs).
//   - Porte holographique : un champ qu'on traverse, mais qui garde l'air. Il lui faut du courant ;
//     sans courant, il n'y a plus que son cadre, et l'air passe.
// La soudure de joint : clic droit sur un bloc qui ne ferme pas (câble, tuyau, levier, dalle…)
// pour qu'il arrête l'air quand même (encore une fois : on la retire).
import { NEIGHBORS } from './hex.js?v=1.1.5-alpha-mwgq2wrb';

export const SAS_R = 6;          // deux portes de sas plus proches que ça : jamais ouvertes ensemble
export const DOOR_MAX = { airlock: 8, seal: 8, elec: 8, hydro: 32, holo: 16 };
const AROUND = [[0, 0, 1], [0, 0, -1], ...NEIGHBORS.map(([q, r]) => [q, r, 0])];
const key = (q, r, y) => q + ',' + r + ',' + y;

// Les blocs de la porte (même sorte : door) qui touchent (q, r, y), elle comprise
export function doorGroup(get, BLOCKS, q, r, y) {
  const kind = BLOCKS[get(q, r, y)]?.door;
  if (!kind) return [];
  const out = [], seen = new Set([key(q, r, y)]), stack = [[q, r, y]];
  while (stack.length && out.length < (DOOR_MAX[kind] || 8)) {
    const c = stack.pop();
    out.push(c);
    for (const [dq, dr, dy] of AROUND) {
      const n = [c[0] + dq, c[1] + dr, c[2] + dy], k = key(...n);
      if (seen.has(k) || BLOCKS[get(...n)]?.door !== kind) continue;
      seen.add(k);
      stack.push(n);
    }
  }
  return out;
}

// L'id d'un bloc de porte, ouvert ou fermé
export const doorState = (BLOCKS, id, open) => (BLOCKS[id]?.door ? (open ? BLOCKS[id].openId : BLOCKS[id].closedId) : id);
export const isDoorOpen = (BLOCKS, id) => !!BLOCKS[id]?.doorOpen;

// Ouvre ou ferme toute la porte (set : pose un bloc). Renvoie le nombre de blocs changés.
export function setDoor(get, set, BLOCKS, q, r, y, open) {
  let n = 0;
  for (const c of doorGroup(get, BLOCKS, q, r, y)) {
    const id = get(...c), want = doorState(BLOCKS, id, open);
    if (want !== id) { set(...c, want); n++; }
  }
  return n;
}

// Sas : les autres portes de sas proches qui sont ouvertes (à fermer avant d'ouvrir celle-ci)
export function otherAirlocks(get, BLOCKS, q, r, y, mine) {
  const own = new Set(mine.map((c) => key(...c))), out = [];
  for (let dq = -SAS_R; dq <= SAS_R; dq++) {
    for (let dr = Math.max(-SAS_R, -dq - SAS_R); dr <= Math.min(SAS_R, -dq + SAS_R); dr++) {
      for (let dy = -SAS_R; dy <= SAS_R; dy++) {
        const c = [q + dq, r + dr, y + dy], b = BLOCKS[get(...c)];
        if (b?.door === 'airlock' && b.doorOpen && !own.has(key(...c))) out.push(c);
      }
    }
  }
  return out;
}

// Porte qui suit le courant : ouverte si l'un de ses blocs est alimenté
export function poweredDoor(get, BLOCKS, q, r, y, powered) {
  const group = doorGroup(get, BLOCKS, q, r, y);
  return { group, on: group.some((c) => powered(...c)) };
}
