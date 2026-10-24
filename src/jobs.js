// Tâches lourdes exécutées dans les threads de travail (génération + maillages).
// Même code sur le thread principal si les Web Workers ne sont pas disponibles.
import { BlockSource, buildChunkArrays, buildLodArrays, transferList } from './mesher.js?v=1.1.5-alpha-mvm2b95g';

export function createJobHandler() {
  let src = null;
  let uv = null;
  let epoch = 0;
  let capN = 0; // (taille du cache reçue avant le monde)

  // Retourne [réponse, tampons à transférer] ou null
  return function handle(msg) {
    switch (msg.type) {
      case 'uv':
        uv = msg.uv;
        return null;
      case 'init':
        epoch = msg.epoch;
        src = new BlockSource({ ...msg, cap: msg.cap || capN });
        return null;
      case 'mods':
        if (src) src.applyMods(msg.list);
        return null;
      case 'cap':
        if (src) src.cap = msg.n;
        capN = msg.n;
        return null;
      case 'chunk': {
        // génère le chunk (données) et son maillage
        const data = src.chunk(msg.cq, msg.cr);
        const { opaque, water, rails, glow, lights } = buildChunkArrays(src, msg.cq, msg.cr, data, uv, 1);
        // (les profondeurs aussi, si le chunk est près du joueur : voir world.update)
        const deep = msg.deep ? buildChunkArrays(src, msg.cq, msg.cr, data, uv, 0) : null;
        const copy = data.slice(); // le thread garde sa copie en cache
        return [{ type: 'chunk', epoch, job: msg.job, cq: msg.cq, cr: msg.cr, data: copy, opaque, water, rails, glow, lights, deep },
          [copy.buffer, ...transferList(opaque, water, rails, glow, lights), ...(deep ? transferList(deep.opaque, deep.water, deep.rails, deep.glow, deep.lights) : [])]];
      }
      case 'mesh': {
        // (sec : sous-chunk, 0 = profondeurs, 1 = surface)
        const sec = msg.sec ?? 1;
        const data = src.chunk(msg.cq, msg.cr);
        const { opaque, water, rails, glow, lights } = buildChunkArrays(src, msg.cq, msg.cr, data, uv, sec);
        return [{ type: 'mesh', epoch, job: msg.job, cq: msg.cq, cr: msg.cr, rev: msg.rev, sec, opaque, water, rails, glow, lights },
          transferList(opaque, water, rails, glow, lights)];
      }
      case 'lod': {
        const { opaque, water } = buildLodArrays(src, msg.unit, uv);
        return [{ type: 'lod', epoch, job: msg.job, key: msg.key, token: msg.token, opaque, water },
          transferList(opaque, water)];
      }
      default:
        return null;
    }
  };
}
