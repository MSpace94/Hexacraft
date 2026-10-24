// Sauvegardes : plusieurs mondes, un fichier par monde.
// On ne stocke que les blocs modifiés par rapport au monde généré (type + graine),
// plus l'état du joueur.
//  - Application (Electron) : fichiers .json dans le dossier de données du jeu
//  - Navigateur : localStorage

import { OFF } from './mesher.js?v=1.1.5-alpha-mvm2b95g';

const native = window.hexaNative;
const PREFIX = 'hexacraft.world.';
const OLD_KEY = 'hexacraft.save.v1';

export function isValid(data) {
  return !!(data && data.game === 'HexaCraft' && data.world && data.world.chunks && data.player);
}

// Complète une sauvegarde (y compris l'ancien format v1 : un seul monde plat).
export function normalize(data, id) {
  if (!isValid(data)) return null;
  return {
    ...data,
    version: 2,
    id: data.id || id || 'monde',
    name: data.name || 'Mon monde',
    type: data.type || data.world.type || 'flat',
    seed: data.seed ?? '0',
    genVersion: data.genVersion ?? 1, // mondes créés avant la version 2 du générateur
    createdAt: data.createdAt || data.savedAt || new Date().toISOString(),
  };
}

// (index d'une case dans la sauvegarde : celui d'avant les profondeurs, (y * CS + lr) * CS + lq,
// négatif sous 0 ; dans le jeu, le tableau d'un chunk commence en -DEEP : voir OFF)
export function serialize(meta, world, player, slot, time, hotbar, carts = []) {
  const chunks = {};
  for (const [k, m] of world.mods) if (m.size) chunks[k] = Array.from(m, ([i, id]) => [i - OFF, id]);
  // Version du générateur de chaque chunk déjà créé : { "2": "0,0;0,1;..." }
  const gen = {};
  for (const [k, v] of world.chunkVer) (gen[v] ||= []).push(k);
  for (const v of Object.keys(gen)) gen[v] = gen[v].join(';');
  return {
    game: 'HexaCraft',
    version: 2,
    id: meta.id,
    name: meta.name,
    type: meta.type,
    seed: meta.seed,
    genVersion: meta.genVersion,
    mode: meta.mode || 'creative', // 'creative' | 'survival'
    ...(meta.hardcore ? { hardcore: true } : {}), // (survie à une seule vie : voir main.js)
    createdAt: meta.createdAt,
    savedAt: new Date().toISOString(),
    time,
    world: { chunks, gen, carts },
    player: {
      x: player.pos.x, y: player.pos.y, z: player.pos.z,
      yaw: player.yaw, pitch: player.pitch, fly: player.fly, slot, hotbar,
    },
  };
}

export function applyToWorld(data, world, player) {
  world.setGenerator(data.type, data.seed, data.genVersion ?? 1);
  // Les chunks déjà créés gardent leur version du générateur (jamais regénérés autrement).
  // Les sauvegardes d'avant ce suivi n'ont pas la liste : leurs chunks prendront la version actuelle.
  for (const [v, list] of Object.entries(data.world.gen || {})) {
    if (typeof list !== 'string' || !list) continue;
    for (const k of list.split(';')) world.chunkVer.set(k, Number(v));
  }
  // les endroits déjà visités avant le monde surélevé (HexaCraft 0.8.6) restent comme avant
  world.gen.setOldChunks(world.chunkVer);
  for (const [k, pairs] of Object.entries(data.world.chunks)) {
    if (!Array.isArray(pairs)) continue;
    world.mods.set(k, new Map(pairs.filter((p) => Array.isArray(p) && p.length === 2).map(([i, id]) => [i + OFF, id])));
  }
  const p = data.player;
  if (p.x === undefined) {
    player.spawn();
  } else {
    player.pos.set(+p.x || 0, +p.y || 4, +p.z || 0);
    player.vel.set(0, 0, 0);
    player.yaw = +p.yaw || 0;
    player.pitch = +p.pitch || 0;
    player.fly = !!p.fly;
  }
}

export function makeId(name) {
  const base = String(name).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'monde';
  const taken = new Set(listWorlds().map((w) => w.id));
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

// ---------- Stockage ----------

function parse(text, id) {
  try { return normalize(JSON.parse(text), id); } catch { return null; }
}

function migrateBrowser() {
  try {
    const old = localStorage.getItem(OLD_KEY);
    if (!old) return;
    if (!localStorage.getItem(PREFIX + 'monde')) localStorage.setItem(PREFIX + 'monde', old);
    localStorage.removeItem(OLD_KEY);
  } catch { /* ignoré */ }
}

export function listWorlds() {
  let list = [];
  // (un monde illisible reste dans la liste, marqué « broken » : on peut le restaurer depuis
  // une copie de secours au lieu de le voir disparaître)
  const read = (text, id) => parse(text, id) || { id, name: id, broken: true, savedAt: '' };
  if (native) {
    list = native.listSaves().map(({ id, text }) => read(text, id));
  } else {
    migrateBrowser();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(PREFIX)) list.push(read(localStorage.getItem(key), key.slice(PREFIX.length)));
      }
    } catch { /* ignoré */ }
  }
  return list.filter(Boolean).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

// ---------- Sauvegardes de secours ----------
// Application : plusieurs copies datées par monde (voir app/main.cjs). Navigateur : une seule,
// renouvelée au plus toutes les 10 minutes.
const BACKUP = 'hexacraft.backup.';
export function saveWorld(data) {
  try {
    const text = JSON.stringify(data);
    if (native) return native.writeSave(data.id, text);
    try {
      const prev = localStorage.getItem(PREFIX + data.id), b = JSON.parse(localStorage.getItem(BACKUP + data.id) || 'null');
      if (prev && parse(prev, data.id) && (!b || Date.now() - b.time > 10 * 60 * 1000)) localStorage.setItem(BACKUP + data.id, JSON.stringify({ time: Date.now(), text: prev }));
    } catch { /* (place insuffisante : pas de copie) */ }
    localStorage.setItem(PREFIX + data.id, text);
    return true;
  } catch {
    return false;
  }
}

export function deleteWorld(id) {
  try {
    if (native) native.deleteSave(id);
    else localStorage.removeItem(PREFIX + id);
  } catch { /* ignoré */ }
}

// Copies de secours d'un monde : [{ name, time (ms) }], la plus récente d'abord
export function listBackups(id) {
  try {
    if (native) return native.listBackups?.(id) || [];
    const b = JSON.parse(localStorage.getItem(BACKUP + id) || 'null');
    return b ? [{ name: 'local', time: b.time }] : [];
  } catch { return []; }
}

// Remet une copie de secours à la place du monde (la version actuelle devient une copie)
export function restoreBackup(id, name) {
  try {
    if (native) return !!native.restoreBackup?.(id, name);
    const b = JSON.parse(localStorage.getItem(BACKUP + id) || 'null');
    if (!b || !parse(b.text, id)) return false;
    const cur = localStorage.getItem(PREFIX + id);
    localStorage.setItem(PREFIX + id, b.text);
    if (cur && parse(cur, id)) localStorage.setItem(BACKUP + id, JSON.stringify({ time: Date.now(), text: cur }));
    return true;
  } catch { return false; }
}
