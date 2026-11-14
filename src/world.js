import * as THREE from 'three';
import { CORNERS, NEIGHBORS, SIZE, hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mwgq2wrb';
import { BLOCKS, AIR, WATER, WATER_FALL, SOLID, OPAQUE, ATTACHED, SLAB, SUPPORT, blockBox, isRail, isTorch, isWire, isWater, isPhysics, waterStrength, flowId, fallId, isIceWater, isWaterSource, isLava, lavaStrength, lavaFlowId, LAVA_FALL, inSolidPart, isSnowLayer, holdsSnow, snowBase } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
const LAVA = 72, COBBLE = 28, OBSIDIAN = 74;
import { Generator, GEN_CONTENT } from './gen.js?v=1.1.5-alpha-mwgq2wrb';
import { zoneOfQ, zoneOfXZ, Z_VOID, Z_ROCK, rockOfQR, slotOfQR, isRuinSlot } from './spacegen.js?v=1.1.5-alpha-mwgq2wrb';
import { RUIN_BOX } from './station.js?v=1.1.5-alpha-mwgq2wrb';
import { createWaterMaterial } from './water.js?v=1.1.5-alpha-mwgq2wrb';
import { CS, DEEP, H, idx, chunkKey, unitKey, columnSurface, lodStep, Y_MIN, ABYSS_TOP } from './mesher.js?v=1.1.5-alpha-mwgq2wrb';
import { LIGHT_M } from './light.js?v=1.1.5-alpha-mwgq2wrb';
import { createJobHandler } from './jobs.js?v=1.1.5-alpha-mwgq2wrb';

export { CS, H, Y_MIN };

// Profondeurs (sous-chunk du bas, -80 à -1 : voir mesher.js) : dessinées seulement pour les chunks
// à moins de DEEP_NEAR blocs du joueur quand il est à la surface (on ne les voit que par un
// trou), et pour tous les chunks complets quand il descend sous DEEP_Y. Retirées au-delà (avec
// une marge, pour ne pas les refaire sans cesse).
const DEEP_NEAR = 44, DEEP_Y = 24, DEEP_MARGIN = 24;
// Sous-chunks qu'une modification en y touche (ses faces, sa lumière jusqu'à reach cases) :
// 1 les profondeurs (ABYSS_TOP à -1), 2 la surface (0 et plus), 4 l'abîme (sous ABYSS_TOP)
function secsAt(y, reach) {
  return (y >= -reach ? 2 : 0) | (y < reach && y >= ABYSS_TOP - reach ? 1 : 0) | (y < ABYSS_TOP + reach ? 4 : 0);
}
// L'abîme (de -81 à Y_MIN, le troisième sous-chunk) : jamais dessiné depuis la surface ; à moins
// d'ABYSS_NEAR blocs quand le joueur descend sous ABYSS_Y, partout autour quand il y est
const ABYSS_NEAR = 36, ABYSS_Y = -30, ABYSS_IN = -70;

// Niveaux de détail (LOD). Au-delà de la zone en détail complet, le terrain est
// dessiné avec de grands hexas : un pour 2x2 hexas, puis un pour 4x4. La grille des
// hexas (q, r) pairs forme exactement une grille hexagonale 2x plus grande, orientée
// pareil : les grands hexas s'emboîtent sans trou.
// Pour limiter le nombre d'objets à dessiner, les zones lointaines sont regroupées
// en "blocs" de 1, 2x2 ou 4x4 chunks, chacun dessiné en un seul appel.
const FADE_MS = 450, FADE_STEPS = 8; // fondu d'un chunk complet qui remplace le terrain simplifié
const LOD_MAX = 128;           // plus grand bloc simplifié : 128 x 128 chunks (grands hexas de 64)
const MARGIN = 10;             // marge anti-clignotement autour de la zone complète
const SQ3 = Math.sqrt(3);
// Brouillard (part de la distance d'affichage) : il commence à FOG_NEAR, tout est brouillard à
// FOG_FAR. Le terrain simplifié s'en sert : dans le brouillard, les détails se voient de moins
// en moins, ses grands hexas peuvent grossir (jusqu'à 2 fois, dans le brouillard complet)
export const FOG_NEAR = 0.45, FOG_FAR = 0.95;

// Multi-thread : la génération et les maillages sont faits par des threads de travail
// (un par cœur disponible, 4 au plus). Chacun garde une copie du monde (générateur +
// modifications du joueur), tenue à jour à chaque image. Le thread principal ne fait
// que la physique, l'eau, l'affichage et la création des objets 3D.
const WORKERS = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
const MAX_INFLIGHT = 3;        // tâches en cours par thread (garde la file réactive)
const UPLOAD_BUDGET = 90000;   // sommets envoyés à la carte graphique par image, au plus
                               // (le jeu le baisse selon la qualité : voir uploadBudget)
const ATTR_SIZE = { position: 3, uv: 2, normal: 3, color: 3, depth: 1, flow: 2, ice: 1, light: 4 };

// release : les tableaux de sommets sont libérés une fois envoyés à la carte graphique (terrain :
// rien ne les relit ; des dizaines de Mo de moins). Les objets qui les modifient (lumière des
// objets collés...) les gardent.
const releaseArray = function () { this.array = null; };
// Un maillage de terrain est rangé par rapport au coin de son chunk (base, voir mesher.js) : on
// le place là. Renvoie le maillage
export function fit(mesh) {
  const b = mesh.geometry.userData.base;
  mesh.position.set(b ? b[0] : 0, 0, b ? b[1] : 0);
  mesh.updateMatrix();
  return mesh;
}
export function geometryFrom(arrays, release = false) {
  const g = new THREE.BufferGeometry();
  for (const [name, arr] of Object.entries(arrays)) {
    if (name === 'sphere' || name === 'base') continue; // (sphère englobante déjà calculée : voir mesher.js)
    const a = name === 'index' ? new THREE.BufferAttribute(arr, 1) : new THREE.BufferAttribute(arr, ATTR_SIZE[name], arr instanceof Int8Array || arr instanceof Uint8Array); // (normales, ombrage sur un octet : normalisés)
    if (release) a.onUpload(releaseArray);
    if (name === 'index') g.setIndex(a); else g.setAttribute(name, a);
  }
  if (arrays.base) g.userData.base = arrays.base;
  const sp = arrays.sphere;
  if (sp) g.boundingSphere = new THREE.Sphere(new THREE.Vector3(sp[0], sp[1], sp[2]), sp[3]);
  else g.computeBoundingSphere();
  return g;
}

// Lumière du ciel au pixel (attribut light.a, voir light.js) : elle règle le soleil, la lune et
// la lumière du ciel. Au fond d'une grotte, il ne reste presque rien (SKY_MIN).
// Lampe de casque : une lumière chaude qui part de la caméra (vViewPosition : le point vu depuis
// la caméra), forte au centre du regard, qui baisse avec la distance (jusqu'à LAMP_REACH blocs)
const LAMP_LIGHT = `
if (uLamp > 0.0) {
  float ld = length(vViewPosition);
  float fall = clamp(1.0 - ld / 18.0, 0.0, 1.0);
  float cone = 0.45 + 0.55 * smoothstep(0.55, 0.95, normalize(-vViewPosition).z);
  outgoingLight += diffuseColor.rgb * vec3(1.0, 0.86, 0.62) * uLamp * fall * fall * cone * 1.25;
}
`;
const SKY_LIGHT = `
reflectedLight.directDiffuse *= vLight.a;
reflectedLight.indirectDiffuse *= max(vLight.a, 0.012);
`;

export class World {
  constructor(scene, atlas) {
    this.scene = scene;
    this.atlas = atlas;
    this.gen = new Generator('flat', '0', H);
    this.viewDist = 192;      // distance d'affichage totale (unités monde)
    this.fullDist = 0;        // distance des chunks complets (simulés pour de vrai) ; 0 : automatique
    this.noLod = false;       // pas de terrain simplifié : tout en détail complet (tutoriels, voir main.js)
    this.chunks = new Map();  // chunks complets : clé -> { cq, cr, data, mesh, water, rev, applied }
    this.lods = new Map();    // blocs simplifiés : clé -> { s, cq, cr, mesh, water }
    this.planKey = '';        // le plan de chargement n'est recalculé que si on change de chunk
    this.mods = new Map();    // clé chunk -> Map(index local -> id) : ce qui diffère du monde généré
    this.highs = new Map();   // clé chunk -> Map(tranche -> blocs) : ce qui est posé au-dessus du monde (voir updateHigh)
    this.highMeshes = new Map(); // « chunk|tranche » -> ses maillages
    this.highDirty = new Set();  // (tranches à redessiner)
    this.highWant = [];       // (tranches à portée, les plus proches d'abord)
    this.highKey = null;
    this.dirty = new Set();   // chunks chargés à remailler (modifiés)
    this.dirtyDeep = new Set();   // ... leurs profondeurs (quand elles sont dessinées)
    this.pendingDeep = new Map(); // profondeurs demandées aux threads (pas encore reçues)
    this.dirtyAbyss = new Set();  // (de même pour l'abîme)
    this.pendingAbyss = new Map();
    // Les sous-chunks sous la surface (voir SECTIONS) : sec, bit (voir markDirty), et leurs champs
    // dans un chunk (le maillage, ses versions demandée / reçue)
    this.unders = [
      { sec: 0, bit: 1, f: 'deep', rev: 'deepRev', ap: 'deepApplied', kind: 'deep', dirty: this.dirtyDeep, pending: this.pendingDeep },
      { sec: 2, bit: 4, f: 'abyss', rev: 'abyssRev', ap: 'abyssApplied', kind: 'abyss', dirty: this.dirtyAbyss, pending: this.pendingAbyss },
    ];
    this.changed = false;
    this.onMeshChange = null; // appelé quand un maillage proche change (ombres à recalculer)
    this.chunkVer = new Map();   // clé chunk -> version du générateur à sa création
    this.waterQueue = new Set(); // cases d'eau à mettre à jour ("q,r,y")
    this.lavaQueue = new Set();  // cases de lave à mettre à jour
    // Lambert : éclairage par le soleil/la lune + lumière du ciel, ombres, brouillard.
    this.material = new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true });
    // Ombres calculées avec les faces tournées vers le soleil. Par défaut, three.js n'utilise que
    // les faces opposées : or les faces cachées entre deux blocs ne sont pas dessinées, donc un
    // toit ou un mur d'un bloc d'épaisseur laissait passer la lumière le long de ses bords.
    this.material.shadowSide = THREE.FrontSide;
    // Lumière propagée (calculée au maillage, voir light.js) : attribut light = torches (rgb)
    // et ciel (a, de 0 au fond d'une grotte à 1 à l'air libre). Le soleil, la lune et la
    // lumière du ciel sont multipliés par le ciel ; la lumière des torches est ajoutée.
    // Le terrain n'utilise plus les lumières ponctuelles (elles traversaient les murs, et
    // coûtaient cher : chacune se calculait pour chaque pixel) ; elles éclairent encore les
    // joueurs, les animaux et les objets.
    // (uLamp : lampe de casque portée, 0..1 : elle éclaire le terrain autour de la caméra)
    this.torchUniforms = { uTorchScale: { value: 1 }, uLamp: { value: 0 } };
    // maillages sans cette lumière (objets collés, chunks simplifiés sans torche) : plein ciel
    const torchShader = (sh) => {
      Object.assign(sh.uniforms, this.torchUniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 light;\nvarying vec4 vLight;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLight = light;');
      // (les lumières ponctuelles sont retirées du calcul : three.js remplace NUM_POINT_LIGHTS
      // par leur nombre, on le remplace d'abord par 0 dans ce morceau)
      sh.fragmentShader = sh.fragmentShader
        // Texture au loin : les plus petits mipmaps de l'atlas mélangent toutes les textures
        // entre elles (l'herbe lointaine devenait beige). On s'arrête au niveau 6 : 2 x 2 pixels
        // par case de 128, encore la couleur de la texture seule.
        .replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )',
          'textureLod( map, vMapUv, min( 6.0, 0.5 * log2( max( max( dot( dFdx( vMapUv * vec2( textureSize( map, 0 ) ) ), dFdx( vMapUv * vec2( textureSize( map, 0 ) ) ) ), dot( dFdy( vMapUv * vec2( textureSize( map, 0 ) ) ), dFdy( vMapUv * vec2( textureSize( map, 0 ) ) ) ) ), 1e-8 ) ) ) )'))
        .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(/NUM_POINT_LIGHTS/g, '0'))
        .replace('#include <common>', '#include <common>\nvarying vec4 vLight;\nuniform float uTorchScale;\nuniform float uLamp;')
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + SKY_LIGHT)
        .replace('#include <opaque_fragment>', 'outgoingLight += diffuseColor.rgb * vLight.rgb * uTorchScale;\n' + LAMP_LIGHT + '#include <opaque_fragment>');
    };
    this.material.defaultAttributeValues = { light: [0, 0, 0, 1] };
    this.material.onBeforeCompile = torchShader;
    this.waterMaterial = createWaterMaterial();
    // Rails : texture à trous (entre les traverses), visibles des deux côtés ; même
    // lumière lointaine des torches que le terrain
    this.railMaterial = new THREE.MeshLambertMaterial({ map: atlas.texture, alphaTest: 0.5, side: THREE.DoubleSide });
    this.railMaterial.defaultAttributeValues = { light: [0, 0, 0, 1] };
    this.railMaterial.onBeforeCompile = torchShader;    // Torches : toujours bien visibles (pas d'éclairage), la teinte vacille un peu (voir main.js)
    this.glowMaterial = new THREE.MeshBasicMaterial({ map: atlas.texture, alphaTest: 0.5, side: THREE.DoubleSide });

    // Tâches en cours
    this.epoch = 0;
    this.needSync = true;
    this.modBatch = [];
    this.jobs = new Map();
    this.jobSeq = 0;
    this.tokenSeq = 0;
    this.pendingLoad = new Map(); // chunk en cours de génération -> { touched }
    this.pendingLod = new Map();  // bloc simplifié en cours -> jeton
    this.fading = new Set();      // chunks complets en train d'apparaître (voir fades)

    // Coordonnées de texture de chaque tuile de l'atlas (envoyées aux threads)
    this.uvTable = {};
    for (const tex of Object.keys(atlas.tiles)) {
      if (tex.endsWith('_cap')) continue;
      const cap = [], side = [];
      for (const [x, z] of CORNERS) cap.push(...atlas.uv(tex + '_cap', 0.5 + x / (2 * SIZE), 0.5 - z / (2 * SIZE)));
      // (textures hexagonales : seulement une bande centrale, voir textures.js)
      const span = atlas.sideSpan(tex), su = (1 - span) / 2;
      for (const [u, v] of [[1, 0], [0, 0], [0, 1], [1, 1]]) side.push(...atlas.uv(tex, su + u * span, v));
      const [u0, v0] = atlas.uv(tex, 0, 0), [u1, v1] = atlas.uv(tex, 1, 1);
      this.uvTable[tex] = { cap, side, rect: [u0, v0, u1, v1] };
    }
    // modèle 3D des torches : bâton et flamme découpés dans la texture
    for (const b of Object.values(BLOCKS)) {
      if (b.torch && atlas.tiles[b.top]?.parts) this.uvTable[b.top].parts = atlas.tiles[b.top].parts;
    }
    this.startWorkers();
  }

  // ---------- Threads de travail ----------
  startWorkers() {
    this.pool = [];
    try {
      for (let i = 0; i < WORKERS; i++) {
        const w = new Worker(new URL('./worker.js?v=1.1.5-alpha-mwgq2wrb', import.meta.url), { type: 'module' });
        const slot = { inflight: 0, post: (m, t) => w.postMessage(m, t || []) };
        w.onmessage = (e) => this.onResult(e.data);
        w.onerror = (e) => { console.error('Thread de travail en erreur', e.message); this.useInline(); };
        this.pool.push(slot);
      }
    } catch (err) {
      console.warn('Threads de travail indisponibles, calcul sur le thread principal', err);
      this.useInline();
      return;
    }
    this.broadcast({ type: 'uv', uv: this.uvTable });
  }

  // Secours : même code, sur le thread principal (résultats rendus à l'image suivante).
  useInline() {
    if (this.inline) return;
    this.inline = true;
    const handle = createJobHandler();
    this.pool = [{
      inflight: 0,
      post: (m) => {
        const out = handle(m);
        if (out) setTimeout(() => this.onResult(out[0]), 0);
      },
    }];
    this.threadCount = 0;
    this.jobs.clear();
    this.pendingLoad.clear();
    this.pendingLod.clear();
    this.fading?.clear();
    this.needSync = true;
    this.broadcast({ type: 'uv', uv: this.uvTable });
  }

  get threads() {
    return this.inline ? 0 : this.pool.length;
  }

  broadcast(msg) {
    for (const w of this.pool) w.post(msg);
  }

  // Envoie les nouveautés (monde, modifications) à tous les threads avant les tâches.
  flushWorkers() {
    if (this.needSync) {
      this.broadcast({
        type: 'init',
        epoch: this.epoch,
        gtype: this.gen.type,
        seed: this.gen.seed,
        version: this.gen.version,
        surfaceOnly: !!this.surfaceOnly,
        cap: this.cacheCap || 0,
        mods: [...this.mods].map(([k, m]) => [k, [...m]]),
        chunkVer: [...this.chunkVer],
      });
      this.needSync = false;
      this.modBatch = [];
      this.scanHighs(); // (les maillages au-dessus du monde sont à refaire dans ce thread tout neuf)
    } else if (this.modBatch.length) {
      this.broadcast({ type: 'mods', list: this.modBatch });
      this.modBatch = [];
    }
  }

  freeWorker() {
    let best = null;
    for (const w of this.pool) if (w.inflight < MAX_INFLIGHT && (!best || w.inflight < best.inflight)) best = w;
    return best;
  }

  send(msg, kind, key) {
    const w = this.freeWorker();
    if (!w) return false;
    msg.job = ++this.jobSeq;
    this.jobs.set(msg.job, { w, kind, key });
    w.inflight++;
    w.post(msg);
    return true;
  }

  onResult(m) {
    const job = this.jobs.get(m.job);
    if (job) { this.jobs.delete(m.job); job.w.inflight--; }
    if (m.type === 'error') {
      console.error('Erreur dans un thread de travail :', m.error);
      if (job?.kind === 'chunk') this.pendingLoad.delete(job.key);
      if (job?.kind === 'lod') this.pendingLod.delete(job.key);
      for (const u of this.unders) if (job?.kind === u.kind) u.pending.delete(job.key);
      return;
    }
    if (m.epoch !== this.epoch) return; // résultat d'un ancien monde
    // Les maillages reçus sont mis en place petit à petit (voir drainResults) : les envoyer
    // tous d'un coup à la carte graphique faisait des à-coups en se déplaçant vite.
    // (un chunk remaillé après un bloc posé / cassé passe tout de suite : réactivité)
    if (m.type === 'mesh' || m.type === 'high') this.applyResult(m);
    else (this.inbox ||= []).push(m);
  }

  // Met en place les maillages reçus, dans la limite d'un budget de sommets par image
  // (uploadBudget : réglé par le jeu selon la qualité ; une petite carte graphique reçoit le
  // terrain un peu moins vite, mais sans à-coups quand on se déplace)
  drainResults(budget = this.uploadBudget || UPLOAD_BUDGET) {
    const inbox = this.inbox;
    if (!inbox || !inbox.length) return;
    let used = 0;
    while (inbox.length && (used === 0 || used < budget)) {
      const m = inbox.shift();
      if (m.epoch !== this.epoch) continue;
      used += (m.opaque?.position?.length || 0) / 3 + (m.water?.position?.length || 0) / 3 + (m.deep?.opaque?.position?.length || 0) / 3 + 200;
      this.applyResult(m);
    }
  }

  applyResult(m) {
    if (m.type === 'chunk') {
      const k = chunkKey(m.cq, m.cr);
      const p = this.pendingLoad.get(k);
      this.pendingLoad.delete(k);
      if (this.chunks.has(k)) return;
      const data = m.data;
      const mods = this.mods.get(k); // modifications arrivées pendant la génération
      if (mods) for (const [i, id] of mods) data[i] = id;
      // (deep : le sous-chunk des profondeurs, quand il est dessiné ; deepRev / deepApplied : ses
      // versions, comme rev / applied pour la surface)
      const chunk = { cq: m.cq, cr: m.cr, data, mesh: null, water: null, rev: 0, applied: 0, deep: null, deepRev: 0, deepApplied: 0, abyss: null, abyssRev: 0, abyssApplied: 0 };
      this.chunks.set(k, chunk);
      this.applyChunkMesh(chunk, m.opaque, m.water, m.rails, m.glow, m.lights);
      if (m.deep) this.applyChunkMesh(chunk.deep = { mesh: null, water: null }, m.deep.opaque, m.deep.water, m.deep.rails, m.deep.glow, m.deep.lights, true);
      this.adoptRails(chunk);
      if (p && p.touched) { this.dirty.add(k); if (chunk.deep) this.dirtyDeep.add(k); }
      this.needCleanup = true;
    } else if (m.type === 'high') {
      this.applyHigh(m);
    } else if (m.type === 'mesh' && m.sec !== 1) {
      // profondeurs, abîme : nouveaux (pending) ou refaits après une modification
      const chunk = this.chunks.get(chunkKey(m.cq, m.cr)), u = this.unders.find((x) => x.sec === m.sec);
      if (!chunk || !u) return;
      const k = chunkKey(m.cq, m.cr);
      if (!chunk[u.f]) {
        if (!u.pending.has(k)) return; // plus voulus entre-temps
        chunk[u.f] = { mesh: null, water: null };
      } else if (m.rev < chunk[u.ap]) return; // réponse périmée
      if (u.pending.get(k)?.touched) u.dirty.add(k); // (modifié pendant le calcul)
      u.pending.delete(k);
      chunk[u.ap] = m.rev;
      this.applyChunkMesh(chunk[u.f], m.opaque, m.water, m.rails, m.glow, m.lights, true);
    } else if (m.type === 'mesh') {
      const chunk = this.chunks.get(chunkKey(m.cq, m.cr));
      if (!chunk) return;
      if (m.rev < chunk.applied) return; // réponse périmée
      chunk.applied = m.rev;
      this.applyChunkMesh(chunk, m.opaque, m.water, m.rails, m.glow, m.lights);
    } else if (m.type === 'lod') {
      if (this.pendingLod.get(m.key) !== m.token) return;
      this.pendingLod.delete(m.key);
      const u = this.units?.get(m.key);
      if (!u || this.lods.has(m.key)) return;
      const mesh = fit(new THREE.Mesh(geometryFrom(m.opaque, true), this.lodMaterial()));
      mesh.matrixAutoUpdate = false;
      mesh.visible = u.s !== 1 || !this.chunks.get(chunkKey(u.cq, u.cr))?.mesh;
      this.scene.add(mesh);
      const lod = { s: u.s, cq: u.cq, cr: u.cr, mesh, water: null, under: null };
      // (dessous d'un ancien monde plat : seulement quand on est sous sa bedrock, voir lodArrays)
      if (m.under) {
        lod.under = fit(new THREE.Mesh(geometryFrom(m.under, true), this.lodMaterial()));
        lod.under.matrixAutoUpdate = false;
        lod.under.visible = mesh.visible && this.camY < 1;
        this.scene.add(lod.under);
      }
      this.setWater(lod, m.water);
      if (lod.water) lod.water.visible = mesh.visible;
      this.lods.set(m.key, lod);
      this.needCleanup = true;
    }
  }

  // Fondu d'un chunk complet qui remplace le terrain simplifié : il apparaît peu à peu (des pixels
  // de plus en plus nombreux, en trame) pendant FADE_MS, le terrain simplifié restant affiché
  // dessous jusqu'à la fin ; avant, on passait d'un coup de l'un à l'autre. Quelques matières, une
  // par étape (même programme ; seule la part de pixels change).
  fadeMaterials() {
    if (!this._fadeMats) {
      this._fadeMats = [];
      for (let i = 1; i < FADE_STEPS; i++) {
        const m = this.material.clone(), base = this.material.onBeforeCompile, part = i / FADE_STEPS;
        m.onBeforeCompile = (sh, r) => {
          base(sh, r);
          sh.uniforms.uFade = { value: part };
          sh.fragmentShader = sh.fragmentShader
            .replace('void main() {', 'uniform float uFade;\nvoid main() {')
            .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif ( fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) > uFade ) discard;');
        };
        m.defaultAttributeValues = this.material.defaultAttributeValues;
        m.shadowSide = this.material.shadowSide;
        m.customProgramCacheKey = () => 'fade';
        this._fadeMats.push(m);
      }
    }
    return this._fadeMats;
  }
  // Avance les fondus en cours (à chaque image)
  fades() {
    if (!this.fading.size) return;
    const now = performance.now(), mats = this.fadeMaterials();
    for (const c of this.fading) {
      const f = (now - c.fadeT) / FADE_MS;
      if (!c.mesh || f >= 1 || !this.chunks.has(chunkKey(c.cq, c.cr))) {
        if (c.mesh) c.mesh.material = this.material;
        c.fadeT = 0;
        this.fading.delete(c);
        this.needCleanup = true; // (le terrain simplifié dessous peut partir)
      } else c.mesh.material = mats[Math.min(mats.length - 1, Math.floor(f * FADE_STEPS))];
    }
  }

  // Matière des blocs simplifiés : celle du terrain, un peu reculée en profondeur. Pendant qu'un
  // chunk complet remplace un bloc simplifié (ou l'inverse), les deux sont affichés un instant
  // au même endroit : sans ce recul, leurs faces se disputaient chaque pixel et ça clignotait.
  // Le chunk complet passe toujours devant. (Créée au premier besoin : main.js a déjà complété
  // le shader du terrain, ombre des nuages comprise.)
  lodMaterial() {
    if (!this._lodMat) {
      const m = this.material.clone();
      m.onBeforeCompile = this.material.onBeforeCompile;
      m.defaultAttributeValues = { ...this.material.defaultAttributeValues, color: [1, 1, 1] }; // (couleur absente : blanc)
      m.shadowSide = this.material.shadowSide;
      m.polygonOffset = true;
      // (recul constant, le même pour toutes les faces : un recul selon la pente reculait bien
      // plus le dessus du terrain vu de loin que les bords verticaux des blocs simplifiés, qui
      // apparaissaient en lignes sombres)
      m.polygonOffsetFactor = 0;
      m.polygonOffsetUnits = 6;
      m.customProgramCacheKey = () => 'lod';
      this._lodMat = m;
    }
    return this._lodMat;
  }

  // chunk : le chunk (sa surface) ou ses profondeurs (deep : sous terre, le soleil n'y arrive
  // pas, pas d'ombres à calculer)
  applyChunkMesh(chunk, opaque, water, rails, glow, lights, deep = false) {
    this.setRails(chunk, rails);
    this.setGlow(chunk, glow);
    chunk.lights = lights ? lights.list : null;
    const geo = geometryFrom(opaque, true);
    if (chunk.mesh) {
      chunk.mesh.geometry.dispose();
      chunk.mesh.geometry = geo;
      fit(chunk.mesh);
    } else {
      chunk.mesh = fit(new THREE.Mesh(geo, this.material));
      chunk.mesh.matrixAutoUpdate = false;
      chunk.mesh.castShadow = !deep;
      chunk.mesh.receiveShadow = !deep;
      this.scene.add(chunk.mesh);
      // (un chunk de la surface qui arrive à la place du terrain simplifié apparaît en fondu : voir fades)
      if (!deep && chunk.shift === undefined && this.lodUnder(chunk.cq, chunk.cr)) { chunk.fadeT = performance.now(); chunk.mesh.material = this.fadeMaterials()[0]; this.fading.add(chunk); }
    }
    this.setWater(chunk, water);
    if (this.onMeshChange) this.onMeshChange();
  }

  // Remplace (ou crée / supprime) le maillage des rails d'un chunk.
  setRails(holder, arrays) {
    if (holder.rails) {
      holder.rails.geometry.dispose();
      if (arrays) { holder.rails.geometry = geometryFrom(arrays, true); fit(holder.rails); return; }
      this.scene.remove(holder.rails);
      holder.rails = null;
      return;
    }
    if (!arrays) return;
    holder.rails = fit(new THREE.Mesh(geometryFrom(arrays, true), this.railMaterial));
    holder.rails.matrixAutoUpdate = false;
    holder.rails.receiveShadow = true;
    this.scene.add(holder.rails);
  }

  // Remplace (ou crée / supprime) le maillage des torches d'un chunk.
  setGlow(holder, arrays) {
    if (holder.glow) {
      holder.glow.geometry.dispose();
      if (arrays) { holder.glow.geometry = geometryFrom(arrays, true); fit(holder.glow); return; }
      this.scene.remove(holder.glow);
      holder.glow = null;
      return;
    }
    if (!arrays) return;
    holder.glow = fit(new THREE.Mesh(geometryFrom(arrays, true), this.glowMaterial));
    holder.glow.matrixAutoUpdate = false;
    this.scene.add(holder.glow);
  }

  // Torches allumées autour de (x, z) : [{ x, y, z, d2, kind }], les plus proches d'abord
  lightsNear(x, z, max, radius = 48) {
    const out = [];
    const r2 = radius * radius;
    for (const c of this.chunks.values()) {
      for (const l of [c.lights, c.deep?.lights, c.abyss?.lights]) {
      if (!l) continue;
      for (let i = 0; i < l.length; i += 4) {
        const dx = l[i] - x, dz = l[i + 2] - z, d2 = dx * dx + dz * dz;
        if (d2 < r2) out.push({ x: l[i], y: l[i + 1], z: l[i + 2], kind: l[i + 3], d2 });
      }
      }
    }
    for (const h of this.highMeshes.values()) {
      const l = h.lights;
      if (l) for (let i = 0; i < l.length; i += 4) {
        const dx = l[i] - x, dz = l[i + 2] - z, d2 = dx * dx + dz * dz;
        if (d2 < r2) out.push({ x: l[i], y: l[i + 1], z: l[i + 2], kind: l[i + 3], d2 });
      }
    }
    out.sort((a, b) => a.d2 - b.d2);
    return out.length > max ? out.slice(0, max) : out;
  }

  // Remplace (ou crée / supprime) le maillage d'eau d'un objet { water }.
  setWater(holder, arrays) {
    if (holder.water) {
      holder.water.geometry.dispose();
      if (arrays) { holder.water.geometry = geometryFrom(arrays, true); fit(holder.water); return; }
      this.scene.remove(holder.water);
      holder.water = null;
      return;
    }
    if (!arrays) return;
    holder.water = fit(new THREE.Mesh(geometryFrom(arrays, true), this.waterMaterial));
    holder.water.matrixAutoUpdate = false;
    this.scene.add(holder.water);
  }

  // ---------- Monde ----------
  // Distances : détail complet (r0), grands hexas x2 (r1), x4 jusqu'à la vue totale (r2).
  get lodRanges() {
    const v = this.viewDist;
    if (this.noLod) return [v, v, v];
    // (chunks complets : réglage du joueur, sinon 30 % de la vue, de 40 à 80 blocs ; toujours un
    // peu moins que la vue, le terrain simplifié commence après)
    const r0 = Math.min(this.fullDist ? Math.max(40, this.fullDist) : Math.max(40, Math.min(80, Math.round(v * 0.3))), Math.max(40, v - 16));
    // (les grands hexas x2 s'arrêtent à 256 blocs : au-delà, les x4 suffisent et coûtent
    // bien moins cher quand la distance d'affichage est très grande)
    return [r0, Math.max(r0 + 32, Math.min(256, v * 0.6)), v];
  }
  // Distance des chunks complets réellement utilisée (affichage des options)
  get fullDistance() { return this.lodRanges[0]; }
  get viewDistance() {
    return this.viewDist;
  }

  // N'affiche que le terrain à moins de R blocs de (px, pz) : au départ et à l'arrivée d'une ligne
  // spatiale, voir spaceflight.js (Infinity : tout)
  clipLand(px, pz, R) {
    const set = (o, on) => o?.layers.set(on ? 0 : 2);
    const near = (cq, cr, s) => {
      const hq = (cq + s / 2) * CS, hr = (cr + s / 2) * CS;
      return R === Infinity || Math.hypot(SIZE * SQ3 * (hq + hr / 2) - px, SIZE * 1.5 * hr - pz) < R;
    };
    for (const c of this.chunks.values()) { const on = near(c.cq, c.cr, 1); set(c.mesh, on); set(c.water, on); set(c.rails, on); set(c.glow, on); }
    for (const l of this.lods.values()) { const on = near(l.cq, l.cr, l.s); set(l.mesh, on); set(l.water, on); set(l.under, on); }
  }

  // surfaceOnly : le monde du menu (écran titre) ; seule la surface (0 à H - 1) est générée et
  // dessinée, les profondeurs ne sont qu'un bloc de pierre (personne n'y descend : moins de lag)
  setGenerator(type, seed, version = 2, surfaceOnly = false) {
    this.reset();
    this.surfaceOnly = surfaceOnly;
    this.gen = new Generator(type, seed, H, version);
    this.gen.surfaceOnly = surfaceOnly;
    // chaque chunk est regénéré avec la version qu'il avait à sa création
    // (la dernière réponse est gardée : le générateur la demande pour presque chaque case d'un même
    // chunk ; refaite si la liste a changé)
    let vq = NaN, vr = NaN, vn = -1, vv = GEN_CONTENT;
    this.gen.versionAt = (q, r) => {
      const cq = Math.floor(q / CS), cr = Math.floor(r / CS);
      if (cq !== vq || cr !== vr || vn !== this.chunkVer.size) { vq = cq; vr = cr; vn = this.chunkVer.size; vv = this.chunkVer.get(chunkKey(cq, cr)) ?? GEN_CONTENT; }
      return vv;
    };
    this.gen.setOldChunks(this.chunkVer);
    this.needSync = true;
  }

  findSpawn() {
    return this.gen.findSpawn();
  }

  // Le chunk de la colonne (q, r) est-il chargé (détail complet) ?
  isLoaded(q, r) {
    return !!this.chunks.get(chunkKey(Math.floor(q / CS), Math.floor(r / CS)))?.data;
  }

  // Ce point est-il dans le vide spatial ? (là-bas, il n'y a pas de « sous le monde »)
  inVoid(x, z) { return !!this.gen?.isVoid?.(worldToHex(x, z).q); }

  getBlock(q, r, y) {
    if (y < Y_MIN) return this.gen?.isVoid?.(q) ? AIR : 4; // (dans l'espace : encore le vide)
    if (y >= H) {
      // (au-dessus du monde, il n'y a que ce qu'on y a posé ; rien du tout, le plus souvent)
      if (!this.highs.size && !this.needSync) return AIR;
      const cq = Math.floor(q / CS), cr = Math.floor(r / CS);
      return this.mods.get(chunkKey(cq, cr))?.get(idx(q - cq * CS, r - cr * CS, y)) || AIR;
    }
    const cq = Math.floor(q / CS), cr = Math.floor(r / CS);
    const i = idx(q - cq * CS, r - cr * CS, y);
    const k = chunkKey(cq, cr);
    const c = this.chunks.get(k);
    if (c) return c.data[i];
    const m = this.mods.get(k);
    if (m && m.has(i)) return m.get(i);
    return this.gen.block(q, r, y);
  }

  // Solide = bloque le joueur (l'eau ne l'est pas).
  isSolid(q, r, y) {
    return SOLID[this.getBlock(q, r, y)] === 1;
  }

  // quiet : case au cœur d'une énorme explosion (voir tnt.js), tout le voisinage part aussi.
  // On saute ce qui coûte cher et ne sert qu'aux bords : comparaison avec le terrain généré,
  // réveil de l'eau, voisins (feuilles, circuits...) — seuls coffres, fours et blocs
  // physiques sont signalés.
  setBlock(q, r, y, id, quiet = false) {
    if (y < Y_MIN) return false;
    const high = y >= H; // (pas de limite vers le haut : voir updateHigh)
    const old = this.getBlock(q, r, y);
    const cq = Math.floor(q / CS), cr = Math.floor(r / CS);
    const i = idx(q - cq * CS, r - cr * CS, y);
    const k = chunkKey(cq, cr);
    const c = high ? null : this.chunks.get(k);
    if (c) c.data[i] = id;
    const p = high ? null : this.pendingLoad.get(k);
    if (p) p.touched = true;

    let m = this.mods.get(k);
    if (id && this.onVoidBlock && this.gen.isVoid?.(q)) this.onVoidBlock(q, r); // (construire dans le vide : voir spaceflight.js)
    if (high ? !id : !quiet && id === this.gen.block(q, r, y) && BLOCKS[id]?.track === undefined) {
      if (m) { m.delete(i); if (!m.size) this.mods.delete(k); }
      this.modBatch.push([k, i, -1]);
    } else {
      if (!m) this.mods.set(k, (m = new Map()));
      m.set(i, id);
      this.modBatch.push([k, i, id]);
    }

    const lq = q - cq * CS, lr = r - cr * CS;
    if (high) {
      if (!!id !== !!old) this.countHigh(k, y, id ? 1 : -1);
      this.markHigh(q, r, y, !!(BLOCKS[id]?.light || BLOCKS[old]?.light));
    } else {
    // sous-chunks touchés : celui de la case, et l'autre si elle est à sa limite (ses faces et sa
    // lumière en dépendent)
    const lit = BLOCKS[id]?.light || BLOCKS[old]?.light || (!quiet && !!OPAQUE[id] !== !!OPAQUE[old]);
    const reach = lit ? LIGHT_M + 1 : 1;
    const secs = secsAt(y, reach);
    if (quiet && !BLOCKS[old]?.light && lq > 0 && lr > 0 && lq < CS - 1 && lr < CS - 1) {
      this.markDirty(q, r, secs); // les voisines sont dans le même chunk
    } else {
      this.markDirty(q, r, secs);
      for (const [dq, dr] of NEIGHBORS) this.markDirty(q + dq, r + dr, secs);
    }
    // la lumière change (torche, ou bloc qui arrête ou laisse passer la lumière) : elle se
    // propage jusqu'à LIGHT_M cases, les chunks voisins aussi sont à refaire (voir light.js)
    if (lit) {
      const R = LIGHT_M;
      for (const dq of [-R, 0, R]) for (const dr of [-R, 0, R]) this.markDirty(q + dq, r + dr, secs);
    }
    }
    this.changed = true;
    // multijoueur : chaque modification est transmise (voir net.js)
    if (this.onBlockSet) this.onBlockSet(q, r, y, id);
    if (this.onAnySet) this.onAnySet(q, r, y, id, old); // (toutes les modifications, même les explosions : voies du train)
    if (quiet) {
      if (this.afterSet && (BLOCKS[old]?.container || isPhysics(old))) this.afterSet(q, r, y, id, old);
    } else {
      if (this.afterSet) this.afterSet(q, r, y, id, old); // ex. une torche d'énergie allume la TNT voisine
      this.wakeWater(q, r, y);
    }
    // (une couche de neige s'en va avec ce qui la porte)
    if (!holdsSnow(id) && isSnowLayer(this.getBlock(q, r, y + 1))) this.setBlock(q, r, y + 1, AIR, quiet);
    if (!SUPPORT[id]) {
      const up = this.getBlock(q, r, y + 1);
      // (onPop : ce qui tombe faute de support revient en objet, voir main.js)
      if (ATTACHED[up] && BLOCKS[up].wall === undefined) { this.setBlock(q, r, y + 1, AIR); this.onPop?.(q, r, y + 1, up); }
      // torches murales accrochées sur ses côtés
      for (let k = 0; k < 6; k++) {
        const [dq, dr] = NEIGHBORS[k], n = this.getBlock(q + dq, r + dr, y);
        if (BLOCKS[n]?.wall === (k + 3) % 6) { this.setBlock(q + dq, r + dr, y, AIR); this.onPop?.(q + dq, r + dr, y, n); }
      }
    }
    return true;
  }

  // ---------- Au-dessus du monde (aucune limite de hauteur) ----------
  // Les chunks ne vont que jusqu'à H - 1 : au-dessus, les blocs ne sont que dans les modifications
  // (rien à générer, rien à garder en mémoire pour le vide). Ils sont dessinés par tranches de H
  // blocs, là où il y en a seulement.
  countHigh(k, y, n) {
    const band = Math.floor((y - H) / H);
    let bands = this.highs.get(k);
    if (!bands) this.highs.set(k, (bands = new Map()));
    const v = (bands.get(band) || 0) + n;
    if (v > 0) bands.set(band, v); else bands.delete(band);
    if (!bands.size) this.highs.delete(k);
    if (v === n || v <= 0) this.highKey = null; // (une tranche apparaît ou disparaît)
  }
  scanHighs() {
    this.highs.clear();
    for (const h of [...this.highMeshes.keys()]) this.dropHigh(h);
    this.highDirty.clear();
    this.highKey = null;
    const from = (H + DEEP) * CS * CS;
    for (const [k, m] of this.mods) for (const [i, id] of m) if (i >= from && id) this.countHigh(k, Math.floor(i / (CS * CS)) - DEEP, 1);
  }
  markHigh(q, r, y, lit) {
    const band = Math.floor((y - H) / H), cq = Math.floor(q / CS), cr = Math.floor(r / CS);
    this.highDirty.add(chunkKey(cq, cr) + '|' + band);
    const lq = q - cq * CS, lr = r - cr * CS, R = lit ? LIGHT_M + 1 : 1;
    if (lq >= R && lr >= R && lq < CS - R && lr < CS - R) return;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      if ((a < 0 && lq >= R) || (a > 0 && lq < CS - R) || (b < 0 && lr >= R) || (b > 0 && lr < CS - R)) continue;
      this.highDirty.add(chunkKey(cq + a, cr + b) + '|' + band);
    }
  }
  dropHigh(hk) {
    const h = this.highMeshes.get(hk);
    if (!h) return;
    for (const o of [h.mesh, h.water, h.rails, h.glow]) if (o) { this.scene.remove(o); o.geometry.dispose(); }
    this.highMeshes.delete(hk);
  }
  // Y a-t-il des blocs au-dessus du monde à moins de R blocs de ce point ? (une tour : on n'est pas
  // parti dans l'espace tant qu'on est dessus, voir spaceflight.js)
  highNear(x, y, z, R) {
    if (!this.highs.size) return false;
    const { q, r } = worldToHex(x, z), cq = Math.floor(q / CS), cr = Math.floor(r / CS), n = Math.ceil(R / CS) + 1;
    const b0 = Math.floor((y - R - H) / H), b1 = Math.floor((y + R - H) / H);
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
      const bands = this.highs.get(chunkKey(cq + a, cr + b));
      if (bands) for (let t = b0; t <= b1; t++) if (bands.has(t)) return true;
    }
    return false;
  }
  updateHigh(px, pz, py) {
    if (!this.highs.size && !this.highMeshes.size) return;
    const { q, r } = worldToHex(px, pz), key = Math.floor(q / CS) + ',' + Math.floor(r / CS) + ',' + Math.floor(py / 32);
    if (key !== this.highKey) {
      this.highKey = key;
      // (jusqu'à la distance d'affichage : une tour se voit de loin ; une marge pour ne pas la refaire sans cesse)
      const R = this.lodRanges[2], V = R * 1.5, want = [], keep = new Set();
      for (const [k, bands] of this.highs) {
        const [cq, cr] = k.split(',').map(Number), hq = cq * CS + CS / 2, hr = cr * CS + CS / 2;
        const d = Math.hypot(SIZE * SQ3 * (hq + hr / 2) - px, SIZE * 1.5 * hr - pz);
        if (d > R + MARGIN) continue;
        for (const band of bands.keys()) {
          const y0 = H + band * H;
          if (y0 > py + V + MARGIN || y0 + H < py - V - MARGIN) continue;
          keep.add(k + '|' + band);
          if (d <= R && y0 <= py + V && y0 + H >= py - V) want.push([d, k + '|' + band, cq, cr, band]);
        }
      }
      want.sort((a, b) => a[0] - b[0]);
      this.highWant = want;
      for (const hk of [...this.highMeshes.keys()]) if (!keep.has(hk)) this.dropHigh(hk);
    }
    for (const [, hk, cq, cr, band] of this.highWant) {
      let h = this.highMeshes.get(hk);
      if (h && !this.highDirty.has(hk)) continue;
      if (!this.send({ type: 'high', cq, cr, band, hk, rev: (h?.rev || 0) + 1 }, 'high', hk)) break;
      if (!h) this.highMeshes.set(hk, (h = { cq, cr, band, shift: H + band * H, rev: 0, applied: 0, mesh: null, water: null, rails: null, glow: null, lights: null }));
      h.rev++;
      this.highDirty.delete(hk);
    }
  }
  applyHigh(m) {
    const h = this.highMeshes.get(m.hk);
    if (!h || m.rev < h.applied) return;
    h.applied = m.rev;
    this.applyChunkMesh(h, m.opaque, m.water, m.rails, m.glow, m.lights);
    // (la tranche a été dessinée entre 0 et H - 1 : on la remonte à sa place)
    for (const o of [h.mesh, h.water, h.rails, h.glow]) if (o) { o.position.y = h.shift; o.updateMatrix(); }
    if (h.lights) for (let i = 1; i < h.lights.length; i += 4) h.lights[i] += h.shift;
  }

  // ---------- Écoulement de l'eau ----------
  // Une case (et ses voisines) est remise en file d'attente dès qu'un bloc change autour.
  wakeWater(q, r, y) {
    if (this.simulateWater === false) return; // client en multijoueur : l'eau coule chez l'hôte
    const add = (a, b, c) => { if (c >= Y_MIN && c < H) this.waterQueue.add(a + ',' + b + ',' + c); };
    add(q, r, y); add(q, r, y + 1); add(q, r, y - 1);
    for (const [dq, dr] of NEIGHBORS) add(q + dq, r + dr, y);
    // la lave aussi, s'il y en a autour
    let lava = isLava(this.getBlock(q, r, y)) || isLava(this.getBlock(q, r, y + 1)) || isLava(this.getBlock(q, r, y - 1));
    for (let i = 0; i < 6 && !lava; i++) lava = isLava(this.getBlock(q + NEIGHBORS[i][0], r + NEIGHBORS[i][1], y));
    if (!lava) return;
    const addL = (a, b, c) => { if (c >= Y_MIN && c < H) this.lavaQueue.add(a + ',' + b + ',' + c); };
    addL(q, r, y); addL(q, r, y + 1); addL(q, r, y - 1);
    for (const [dq, dr] of NEIGHBORS) addL(q + dq, r + dr, y);
  }

  // Lave : mêmes règles que l'eau (source, chute, force - 1 par case), mais elle ne va qu'à
  // 3 cases de sa source et coule plus lentement (voir tickLava). Au contact de l'eau, la
  // lave qui coule devient de la pierre taillée, la source de l'obsidienne.
  lavaTarget(q, r, y) {
    const cur = this.getBlock(q, r, y);
    if ((OPAQUE[cur] && cur !== LAVA) || SLAB[cur]) return cur;
    let wet = isWater(this.getBlock(q, r, y + 1));
    for (let i = 0; i < 6 && !wet; i++) wet = isWater(this.getBlock(q + NEIGHBORS[i][0], r + NEIGHBORS[i][1], y));
    if (cur === LAVA) return wet ? OBSIDIAN : LAVA;
    if (!wet) wet = isWater(this.getBlock(q, r, y - 1));
    let next;
    if (cur === AIR && isLava(this.getBlock(q, r, y - 1))) next = isLava(this.getBlock(q, r, y + 1)) ? LAVA_FALL : AIR;
    else if (isLava(this.getBlock(q, r, y + 1))) next = LAVA_FALL;
    else {
      let best = -1;
      for (const [dq, dr] of NEIGHBORS) {
        const n = this.getBlock(q + dq, r + dr, y);
        if (!isLava(n)) continue;
        const under = this.getBlock(q + dq, r + dr, y - 1);
        if (!OPAQUE[under] && !SLAB[under]) continue;
        best = Math.max(best, lavaStrength(n) - 1);
      }
      next = best >= 0 ? lavaFlowId(best) : AIR;
    }
    return wet && isLava(next) ? COBBLE : next;
  }

  // Un pas de lave (moins souvent que l'eau, voir main.js)
  tickLava(maxCells = 600) {
    if (!this.lavaQueue.size) return;
    const list = [];
    for (const k of this.lavaQueue) {
      this.lavaQueue.delete(k);
      list.push(k);
      if (list.length >= maxCells) break;
    }
    const changes = [];
    for (const k of list) {
      const [q, r, y] = k.split(',').map(Number);
      if (!this.chunks.has(chunkKey(Math.floor(q / CS), Math.floor(r / CS)))) continue;
      const cur = this.getBlock(q, r, y);
      // la lave brûle les rails, torches... (comme l'eau les emporte)
      if (cur !== AIR && !ATTACHED[cur] && !isLava(cur)) continue;
      const next = this.lavaTarget(q, r, y);
      if (ATTACHED[cur] ? isLava(next) : next !== cur) changes.push([q, r, y, next]);
    }
    for (const [q, r, y, id] of changes) this.setBlock(q, r, y, id);
  }

  // État que devrait avoir une case d'après ses voisines :
  //  - source : ne change jamais
  //  - de l'eau au-dessus : chute d'eau
  //  - sinon : force de la meilleure voisine - 1 (une voisine ne s'étale que si elle est posée
  //    sur quelque chose, sinon elle tombe) ; plus aucune voisine : la case s'assèche
  waterTarget(q, r, y) {
    const cur = this.getBlock(q, r, y);
    if (OPAQUE[cur] || SLAB[cur] || isWaterSource(cur)) return cur; // l'eau n'emporte pas les dalles
    // (eau glaciale : elle reste glaciale en coulant)
    const above = this.getBlock(q, r, y + 1);
    if (cur === AIR && isWater(this.getBlock(q, r, y - 1))) {
      // au-dessus d'une eau : seule une chute peut arriver ici
      return isWater(above) ? fallId(isIceWater(above)) : AIR;
    }
    if (isWater(above)) return fallId(isIceWater(above));
    let best = -1, ice = false;
    for (const [dq, dr] of NEIGHBORS) {
      const n = this.getBlock(q + dq, r + dr, y);
      if (!isWater(n)) continue;
      // la voisine ne s'étale que si elle repose sur un bloc (sinon elle tombe, ou se fond
      // dans l'eau en dessous : une cascade qui arrive dans un lac s'arrête à la surface)
      const under = this.getBlock(q + dq, r + dr, y - 1);
      if (!OPAQUE[under] && !SLAB[under]) continue;
      const s = waterStrength(n) - 1;
      if (s > best || (s === best && isIceWater(n))) { best = s; ice = isIceWater(n); }
    }
    return best >= 0 ? flowId(best, ice) : AIR;
  }

  // Un pas de simulation (appelé quelques fois par seconde).
  tickWater(maxCells = 600) {
    if (!this.waterQueue.size) return;
    const list = [];
    for (const k of this.waterQueue) {
      this.waterQueue.delete(k);
      list.push(k);
      if (list.length >= maxCells) break;
    }
    const changes = [];
    for (const k of list) {
      const [q, r, y] = k.split(',').map(Number);
      // uniquement dans les chunks chargés (l'eau ne coule pas hors de vue)
      if (!this.chunks.has(chunkKey(Math.floor(q / CS), Math.floor(r / CS)))) continue;
      const cur = this.getBlock(q, r, y);
      // l'eau emporte les rails (comme dans Minecraft)
      if (cur !== AIR && !ATTACHED[cur] && !isWater(cur)) continue;
      const next = this.waterTarget(q, r, y);
      if (ATTACHED[cur] ? isWater(next) : next !== cur) changes.push([q, r, y, next]);
    }
    for (const [q, r, y, id] of changes) this.setBlock(q, r, y, id);
  }

  // secs : sous-chunks à refaire (1 : les profondeurs, 2 : la surface, 4 : l'abîme ; voir secsAt)
  markDirty(q, r, secs = 7) {
    const cq = Math.floor(q / CS), cr = Math.floor(r / CS);
    const k = chunkKey(cq, cr);
    const c = this.chunks.get(k);
    if (c) {
      if (secs & 2) this.dirty.add(k);
      for (const u of this.unders) {
        if (!(secs & u.bit)) continue;
        if (c[u.f]) u.dirty.add(k);
        const pd = u.pending.get(k);
        if (pd) pd.touched = true;
      }
    }
    if (!(secs & 2)) return; // (le terrain simplifié ne montre que la surface)
    // les blocs simplifiés qui couvrent ce chunk seront refaits avec la modification
    for (const s of [1, 2, 4]) {
      const uk = unitKey(s, Math.floor(cq / s) * s, Math.floor(cr / s) * s);
      this.removeLod(uk);
      this.pendingLod.delete(uk);
    }
  }

  unloadChunk(k) {
    const c = this.chunks.get(k);
    if (!c) return;
    if (c.mesh) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); }
    if (c.water) { this.scene.remove(c.water); c.water.geometry.dispose(); }
    if (c.rails) { this.scene.remove(c.rails); c.rails.geometry.dispose(); }
    if (c.glow) { this.scene.remove(c.glow); c.glow.geometry.dispose(); }
    for (const u of this.unders) { this.dropUnder(c, u); u.pending.delete(k); }
    this.chunks.delete(k);
    this.dirty.delete(k);
  }

  // Rails de train générés (mines abandonnées, voir gen.js) : ajoutés aux modifications du monde
  // à l'arrivée de leur chunk (les voies du train ne sont cherchées que là, voir tracks.js), comme
  // s'ils avaient été posés ; un rail déjà cassé (modification) le reste
  adoptRails(c) {
    if (this.gen.type !== 'normal') return;
    const cells = this.gen.mineRails(c.cq, c.cr, CS);
    if (!cells.length) return;
    const k = chunkKey(c.cq, c.cr);
    let m = this.mods.get(k), any = false;
    for (const [q, r, y] of cells) {
      const i = idx(q - c.cq * CS, r - c.cr * CS, y), id = c.data[i];
      if (BLOCKS[id]?.track === undefined || m?.has(i)) continue;
      if (!m) this.mods.set(k, (m = new Map()));
      m.set(i, id);
      this.modBatch.push([k, i, id]);
      any = true;
    }
    if (any) { this.changed = true; this.onRailsAdopted?.(k); }
  }

  // La carte graphique a redémarré (contexte WebGL perdu) : les maillages du terrain sont refaits
  // (leurs sommets ont été libérés après l'envoi). Les blocs restent lisibles entre-temps
  // (générateur + modifications : voir getBlock).
  remeshAll() {
    for (const k of [...this.chunks.keys()]) this.unloadChunk(k);
    for (const k of [...this.lods.keys()]) this.removeLod(k);
    for (const h of [...this.highMeshes.keys()]) this.dropHigh(h);
    this.highKey = null;
    this.pendingLoad.clear();
    this.pendingLod.clear();
    this.fading?.clear();
    for (const u of this.unders) u.pending.clear();
    this.planKey = '';
    this.epoch++;          // (les réponses en route sont pour les anciens maillages)
    this.needSync = true;
  }

  // Retire un sous-chunk sous la surface (u : voir unders) dessiné d'un chunk
  dropUnder(c, u) {
    const d = c[u.f];
    if (!d) return;
    for (const m of [d.mesh, d.water, d.rails, d.glow]) if (m) { this.scene.remove(m); m.geometry.dispose(); }
    c[u.f] = null;
    u.dirty.delete(chunkKey(c.cq, c.cr));
  }

  removeLod(k) {
    const l = this.lods.get(k);
    if (!l) return;
    this.scene.remove(l.mesh);
    l.mesh.geometry.dispose();
    if (l.water) { this.scene.remove(l.water); l.water.geometry.dispose(); }
    if (l.under) { this.scene.remove(l.under); l.under.geometry.dispose(); }
    this.lods.delete(k);
  }

  reset() {
    for (const k of [...this.chunks.keys()]) this.unloadChunk(k);
    for (const k of [...this.lods.keys()]) this.removeLod(k);
    this.mods.clear();
    for (const h of [...this.highMeshes.keys()]) this.dropHigh(h);
    this.highs.clear();
    this.highDirty.clear();
    this.highWant = [];
    this.highKey = null;
    this.chunkVer.clear();
    this.waterQueue.clear();
    this.lavaQueue.clear();
    this.dirty.clear();
    for (const u of this.unders) { u.dirty.clear(); u.pending.clear(); }
    this.pendingLoad.clear();
    this.pendingLod.clear();
    this.fading?.clear();
    this.modBatch = [];
    this.epoch++;
    this.changed = false;
    this.planKey = '';
    this.units = null;
  }

  // Distance (blocs) de (px, pz) au centre d'un chunk
  chunkDist(px, pz) {
    return (cq, cr) => {
      const hq = cq * CS + CS / 2, hr = cr * CS + CS / 2;
      return Math.hypot(SIZE * SQ3 * (hq + hr / 2) - px, SIZE * 1.5 * hr - pz);
    };
  }

  // Plan de chargement autour de (px, pz) : quels chunks complets, quels blocs simplifiés.
  // Recalculé seulement quand le joueur change de chunk (ou de distance d'affichage).
  plan(px, pz) {
    const r0 = this.lodRanges[0], inVoid = zoneOfXZ(px, pz) < 0;
    // (dans l'espace, pas de terrain simplifié au loin : rien à dessiner, rien à calculer)
    const r2 = inVoid ? r0 : this.lodRanges[2];
    const { q, r } = worldToHex(px, pz);
    const pcq = Math.floor(q / CS), pcr = Math.floor(r / CS);
    this.viewX = px; this.viewZ = pz; // (d'où l'on regarde : les voies du train sont dessinées jusqu'à la vue, voir tracks.js)
    // (dans un train qui file sur une ligne spatiale : aucun terrain, il passerait trop vite)
    if (this.noTerrain) {
      if (this.planKey === 'none') return;
      this.planKey = 'none';
      this.fullWant = [];
      this.fullKeep = new Set();
      this.units = new Map();
      this.unitQueue = [];
      this.needCleanup = true;
      return;
    }
    const key = pcq + ',' + pcr + ',' + r2;
    if (key === this.planKey) return;
    this.planKey = key;

    const cdist = (cq, cr) => {
      const hq = cq * CS + CS / 2, hr = cr * CS + CS / 2;
      return Math.hypot(SIZE * SQ3 * (hq + hr / 2) - px, SIZE * 1.5 * hr - pz);
    };
    const fullWant = [], fullKeep = new Set(), units = new Map();
    const addUnit = (s, cq, cr, d) => { if (!this.noLod) units.set(unitKey(s, cq, cr), { s, cq, cr, d }); }; // (sans LOD : rien de simplifié)
    // Blocs simplifiés de plus en plus grands avec la distance (arbre : un bloc de taille s est
    // coupé en 4 de taille s/2 tant qu'il est trop près). Les grands hexas doublent de taille
    // quand la distance double : vus d'ici, ils font toujours à peu près la même taille à l'écran
    // (de 6 à 11 pixels environ), ni trop fins au loin (inutile et très coûteux), ni grossiers.
    // Chaque bloc fait au plus 32 x 32 grands hexas : on peut voir jusqu'à 7500 blocs.
    //   1 chunk : jusqu'à r0 (complet), grands hexas de 2 jusqu'à 2 b, de 4 jusqu'à 4 b... (b : r0 + MARGIN)
    // (dans le brouillard f (0 à 1), un grand hexa peut paraître (1 + f) fois plus grand : on
    // cherche la distance d où d (1 + f(d)) atteint la distance sans brouillard K)
    const b0 = r0 + MARGIN, fn = r2 * FOG_NEAR, w = r2 * (FOG_FAR - FOG_NEAR);
    const fogged = (K) => {
      if (K <= fn) return K;
      const d = (-(w - fn) + Math.sqrt((w - fn) ** 2 + 4 * K * w)) / 2;
      return d <= fn + w ? d : K / 2;
    };
    const limit = (s) => (s <= 1 ? 0 : s === 2 ? b0 : fogged(b0 * lodStep(s) / 2));
    const near = (s, cq, cr) => {
      if (s <= 4) { // (exact : centres des chunks, comme avant)
        let d = Infinity;
        for (let b = 0; b < s; b++) for (let a = 0; a < s; a++) d = Math.min(d, cdist(cq + a, cr + b));
        return d;
      }
      const hq = cq * CS + s * CS / 2, hr = cr * CS + s * CS / 2;
      const dc = Math.hypot(SIZE * SQ3 * (hq + hr / 2) - px, SIZE * 1.5 * hr - pz);
      return Math.max(0, dc - s * CS * 0.75); // (au plus près du bloc)
    };
    const visit = (s, cq, cr) => {
      const d = near(s, cq, cr);
      if (d > r2) return;
      if (s === 1) {
        const k = chunkKey(cq, cr);
        if (d < r0) fullWant.push([d, cq, cr]);
        if (d < r0 + MARGIN) fullKeep.add(k);
        if (d >= r0) addUnit(1, cq, cr, d);
        return;
      }
      if (d >= limit(s)) { addUnit(s, cq, cr, d); return; }
      const h = s / 2;
      visit(h, cq, cr); visit(h, cq + h, cr); visit(h, cq, cr + h); visit(h, cq + h, cr + h);
    };
    let T = 4;
    while (T < LOD_MAX && limit(T * 2) < r2) T *= 2;   // plus grande taille utile
    const R = Math.ceil(r2 / (CS * T * 0.85)) + 1;
    const uq0 = Math.floor(pcq / T), ur0 = Math.floor(pcr / T);
    for (let du = -R; du <= R; du++) for (let dv = -R; dv <= R; dv++) visit(T, (uq0 + du) * T, (ur0 + dv) * T);
    // Dans l'espace, au-delà : les chunks où il y a quelque chose (ce qu'on a construit, la station
    // en ruine, un astéroïde), jusqu'à la distance d'affichage. Sans ça, un coin d'espace restait
    // invisible tant qu'on n'était pas à moins de r0 blocs de lui (pas de terrain simplifié ici)
    let extra = 0;
    if (inVoid) {
      const far = this.lodRanges[2], n = Math.ceil(far / (CS * 0.75)) + 1;
      for (let dr = -n; dr <= n; dr++) {
        for (let dq = -n; dq <= n; dq++) {
          const cq = pcq + dq, cr = pcr + dr, d = cdist(cq, cr);
          if (d < r0 || d >= far || !this.voidContent(cq, cr)) continue;
          fullWant.push([d, cq, cr]);
          fullKeep.add(chunkKey(cq, cr));
          extra++;
        }
      }
    }
    fullWant.sort((a, b) => a[0] - b[0]);
    // chunks gardés en mémoire par chaque thread : ceux de la zone en détail, ses voisins (lumière)
    // et une marge (surface d'un chunk : 16 x 16 cases de 0,866)
    const cap = Math.max(160, Math.min(1400, Math.ceil((Math.PI * (r0 + MARGIN + 2 * CS) ** 2) / (CS * CS * 0.866) * 1.25) + 24 + extra * 2));
    if (cap !== this.cacheCap) { this.cacheCap = cap; this.broadcast({ type: 'cap', n: cap }); }
    this.fullWant = fullWant;
    this.fullKeep = fullKeep;
    this.units = units;
    this.unitQueue = inVoid ? [] : [...units.entries()].sort((a, b) => a[1].d - b[1].d); // (rien à simplifier dans le vide)
    this.needCleanup = true;
  }

  // Un chunk du vide a-t-il quelque chose à montrer ? (des blocs posés, la station en ruine, un astéroïde)
  voidContent(cq, cr) {
    if (this.mods.get(chunkKey(cq, cr))?.size) return true;
    const q = cq * CS + CS / 2, r = cr * CS + CS / 2, c = hexToWorld(q, r), pad = CS;
    const z = zoneOfQ(q);
    if (z === Z_ROCK) {
      const R = rockOfQR(q, r);
      if (!R) return false;
      const o = hexToWorld(R.q0, R.r0);
      return Math.hypot(c.x - o.x, c.z - o.z) < Math.max(R.rx, R.rz) + pad;
    }
    if (z !== Z_VOID) return false;
    const s = slotOfQR(q, r);
    if (!isRuinSlot(s)) return false;
    const o = hexToWorld(s.q0, s.r0), B = RUIN_BOX;
    return c.x > o.x + B.x0 - pad && c.x < o.x + B.x1 + pad && c.z > o.z + B.z0 - pad && c.z < o.z + B.z1 + pad;
  }

  // Distribue le travail aux threads (le plus proche d'abord). Aucun calcul lourd ici.
  // py : hauteur du joueur (profondeurs dessinées plus loin quand il est sous terre)
  update(px, pz, py = 64) {
    this.drainResults();
    this.flushWorkers();
    this.fades();
    this.plan(px, pz);
    // profondeurs voulues : jusqu'à deepR blocs (le tutoriel n'en a pas). Monde plat : son sol est
    // dans l'un des trois sous-chunks (surface, profondeurs ou abîme selon sa version) ; celui-là
    // est toujours dessiné, les autres comme sous un monde normal, par rapport à ce sol. (Avant,
    // au-dessus d'un ancien monde plat, tout son dessous était dessiné partout : invisible sous la
    // bedrock, et très cher)
    const R0 = this.lodRanges[0], none = (this.gen.type !== 'normal' && this.gen.type !== 'flat') || this.surfaceOnly || zoneOfXZ(px, pz) !== 0;
    const fh = this.gen.type === 'flat' ? this.gen.height(0, 0) : null;
    const ground = fh === null || fh >= 0 ? 1 : fh >= ABYSS_TOP ? 0 : 2;
    const deepY = fh === null ? DEEP_Y : fh - 4;
    const deepR = none ? -1 : ground === 0 || py < deepY ? R0 : DEEP_NEAR;
    const deepWant = (d) => d < deepR;
    const abyssR = none ? -1 : ground === 2 ? R0 : py >= ABYSS_Y ? -1 : py < ABYSS_IN ? R0 : ABYSS_NEAR;
    // (dessous du terrain simplifié d'un ancien monde plat : seulement sous sa bedrock)
    const below = py < 1;
    if (below !== this.camY < 1) for (const l of this.lods.values()) if (l.under) l.under.visible = l.mesh.visible && below;
    this.camY = py;
    this.unders[0].R = deepR;
    this.unders[1].R = abyssR;

    // 1. chunks modifiés (réactivité quand on casse / pose un bloc)
    for (const k of this.dirty) {
      const c = this.chunks.get(k);
      if (!c) { this.dirty.delete(k); continue; }
      if (!this.send({ type: 'mesh', cq: c.cq, cr: c.cr, rev: c.rev + 1, sec: 1 }, 'mesh', k)) break;
      c.rev++;
      this.dirty.delete(k);
    }
    for (const u of this.unders) {
      for (const k of u.dirty) {
        const c = this.chunks.get(k);
        if (!c || !c[u.f]) { u.dirty.delete(k); continue; }
        if (!this.send({ type: 'mesh', cq: c.cq, cr: c.cr, rev: c[u.rev] + 1, sec: u.sec }, 'mesh', k)) break;
        c[u.rev]++;
        u.dirty.delete(k);
      }
    }

    // 2. chunks complets à générer (avec leurs profondeurs, si on les dessine déjà à cette distance)
    for (const [d, cq, cr] of this.fullWant) {
      const k = chunkKey(cq, cr);
      if (this.chunks.has(k) || this.pendingLoad.has(k)) continue;
      if (!this.chunkVer.has(k) && zoneOfQ(cq * CS) === 0) { this.chunkVer.set(k, GEN_CONTENT); this.changed = true; } // (ailleurs : pas de versions de terrain à retenir)
      if (!this.send({ type: 'chunk', cq, cr, deep: deepWant(d) }, 'chunk', k)) break;
      this.pendingLoad.set(k, { touched: false });
    }

    // 2 bis. profondeurs des chunks déjà là (le joueur s'approche, ou descend sous terre) ;
    // retirées quand il s'éloigne
    // (de même pour l'abîme, plus près encore)
    const cdist = this.chunkDist(px, pz), check = (this.deepCheck = (this.deepCheck || 0) + 1) % 30 === 0;
    for (const u of this.unders) {
      if (u.R > 0) {
        for (const [d, cq, cr] of this.fullWant) {
          if (d >= u.R) break; // (les plus proches d'abord)
          const k = chunkKey(cq, cr), c = this.chunks.get(k);
          if (!c || c[u.f] || u.pending.has(k)) continue;
          if (!this.send({ type: 'mesh', cq, cr, rev: c[u.rev], sec: u.sec }, u.kind, k)) break;
          u.pending.set(k, { touched: false });
        }
      }
      if (!check) continue;
      // (retirés quand le joueur s'éloigne, ou remonte : l'abîme n'est plus dessiné du tout)
      for (const c of this.chunks.values()) if (c[u.f] && cdist(c.cq, c.cr) > u.R + DEEP_MARGIN) this.dropUnder(c, u);
      for (const k of [...u.pending.keys()]) {
        const [cq, cr] = k.split(',').map(Number);
        if (cdist(cq, cr) > u.R + DEEP_MARGIN) u.pending.delete(k);
      }
    }

    this.updateHigh(px, pz, py);

    // 3. blocs simplifiés
    for (const [k, u] of this.unitQueue) {
      if (this.lods.has(k) || this.pendingLod.has(k)) continue;
      const token = ++this.tokenSeq;
      if (!this.send({ type: 'lod', key: k, unit: { s: u.s, cq: u.cq, cr: u.cr }, token }, 'lod', k)) break;
      this.pendingLod.set(k, token);
    }

    if (this.needCleanup) {
      this.cleanup();
      this.needCleanup = false;
    }
  }

  // Les chunks autour de (px, pz) sont-ils prêts (générés et dessinés) ?
  isReady(px, pz) {
    const { q, r } = worldToHex(px, pz);
    const cq = Math.floor(q / CS), cr = Math.floor(r / CS);
    for (const [dq, dr] of [[0, 0], ...NEIGHBORS]) {
      if (!this.chunks.get(chunkKey(cq + dq, cr + dr))?.mesh) return false;
    }
    return true;
  }

  // Travail restant (pour l'affichage de débogage)
  get pendingJobs() {
    return this.jobs.size;
  }

  // Un bloc simplifié déjà dessiné recouvre-t-il le chunk (cq, cr) ?
  lodUnder(cq, cr) {
    for (let s = 1; s <= LOD_MAX; s *= 2) if (this.lods.has(unitKey(s, Math.floor(cq / s) * s, Math.floor(cr / s) * s))) return true;
    return false;
  }
  // Bloc simplifié (prévu) qui contient le chunk (cq, cr), ou null
  coverOf(cq, cr) {
    for (let s = 1; s <= LOD_MAX; s *= 2) {
      const k = unitKey(s, Math.floor(cq / s) * s, Math.floor(cr / s) * s);
      if (this.units.has(k)) return k;
    }
    return null;
  }

  // Retire ce qui n'est plus utile, mais seulement une fois son remplaçant prêt (pas de trou).
  cleanup() {
    if (!this.units) return;
    const shown = (cq, cr) => {
      const ck = chunkKey(cq, cr);
      if (this.fullKeep.has(ck)) { const c = this.chunks.get(ck); return !!c?.mesh && !c.fadeT; }
      const uk = this.coverOf(cq, cr);
      return !uk || this.lods.has(uk);
    };
    for (const [k, c] of [...this.chunks]) {
      if (this.fullKeep.has(k)) continue;
      const uk = this.coverOf(c.cq, c.cr);
      if (!uk || this.lods.has(uk)) this.unloadChunk(k);
    }
    for (const [uk, l] of [...this.lods]) {
      if (this.units.has(uk)) continue;
      let ok = true;
      // (grands blocs : on regarde un chunk sur s/8 ; les blocs qui les remplacent sont alignés)
      const st = Math.max(1, l.s / 8);
      for (let a = 0; a < l.s && ok; a += st) for (let b = 0; b < l.s && ok; b += st) ok = shown(l.cq + a, l.cr + b);
      if (ok) this.removeLod(uk);
    }
    // un bloc d'un seul chunk est caché tant que la version complète est affichée
    for (const l of this.lods.values()) {
      if (l.s === 1) {
        const c = this.chunks.get(chunkKey(l.cq, l.cr));
        l.mesh.visible = !c?.mesh || !!c.fadeT;
        if (l.water) l.water.visible = l.mesh.visible;
      }
      if (l.under) l.under.visible = l.mesh.visible && this.camY < 1;
    }
  }

  // Surface d'une colonne (pour centrer les ombres sur le sol).
  surface(q, r) {
    const cq = Math.floor(q / CS), cr = Math.floor(r / CS);
    const c = this.chunks.get(chunkKey(cq, cr));
    return c ? columnSurface(c.data, q - cq * CS, r - cr * CS) : this.gen.surface(q, r);
  }

  // Lance un rayon depuis `origin` dans la direction `dir` (normalisée).
  // Retourne le premier hexagone solide touché et la case vide juste avant.
  // Une dalle (horizontale ou verticale) n'arrête le rayon que dans sa moitié pleine. Si le rayon a d'abord traversé
  // sa moitié vide, `into` est vrai (on peut y poser l'autre moitié) et `prev` reste la
  // case d'avant.
  raycast(origin, dir, maxDist) {
    const step = 0.02;
    let prev = null, last = '', slabKey = '', slabPrev = null, snowKey = '', snowPrev = null;
    for (let t = 0; t <= maxDist; t += step) {
      const x = origin.x + dir.x * t, y = origin.y + dir.y * t, z = origin.z + dir.z * t;
      const { q, r } = worldToHex(x, z);
      const ly = Math.floor(y);
      const key = q + ',' + r + ',' + ly;
      if (key === last) continue;
      last = key;
      const id = this.getBlock(q, r, ly);
      if (SLAB[id]) {
        // (dalle verticale : la moitié de la case du côté qu'elle occupe)
        const c = hexToWorld(q, r);
        if (inSolidPart(id, x - c.x, y - ly, z - c.z)) {
          const into = key === slabKey;
          return { hit: { q, r, y: ly }, prev: into ? slabPrev : prev, into, t };
        }
        if (key !== slabKey) { slabKey = key; slabPrev = prev; }
        prev = { q, r, y: ly };
        last = ''; // on teste chaque pas dans sa case
        continue;
      }
      // (rails et fils de voltite : on vise leur fine épaisseur au ras du sol, un peu
      // épaissie pour qu'ils restent faciles à viser)
      // (rail de train : sa voie est épaisse, voir tracks.js)
      if (SOLID[id] || ((isRail(id) || isWire(id)) && y - ly < 0.25) || (BLOCKS[id]?.track !== undefined && y - ly < 0.35) || (BLOCKS[id]?.repeater && y - ly < 0.3)) return { hit: { q, r, y: ly }, prev, t };
      // câble : sa barre à mi-hauteur (un peu épaissie) ; éolienne : son mât et sa nacelle
      const shp = BLOCKS[id]?.shape;
      if (shp === 'cable' || shp === 'wind' || shp === 'wheel' || shp === 'shaft') {
        const c = hexToWorld(q, r), d2 = (x - c.x) ** 2 + (z - c.z) ** 2, h = y - ly;
        const aimed = shp === 'shaft' ? Math.abs(h - 0.5) < 0.17 : shp === 'cable' ? (h > 0.3 && h < 0.7) || d2 < 0.05 : shp === 'wheel' ? h < 0.12 || d2 < 0.2 : h < 0.14 || d2 < (h > 0.75 ? 0.1 : 0.04);
        if (aimed) return { hit: { q, r, y: ly }, prev, t };
        last = '';
        continue;
      }
      // couche de neige : on vise son épaisseur (plus bas sur une dalle basse)
      if (shp === 'snow') {
        if (key !== snowKey) { snowKey = key; snowPrev = prev; }
        if (y - ly < Math.max(0.1, BLOCKS[id].layer / 8 + snowBase(this.getBlock(q, r, ly - 1)))) return { hit: { q, r, y: ly }, prev: snowPrev, t };
        prev = { q, r, y: ly }; // (au-dessus de la neige : comme de l'air)
        last = '';
        continue;
      }
      // photo accrochée : son cadre, contre le mur
      if (BLOCKS[id]?.photo) {
        const c = hexToWorld(q, r), a = (Math.PI / 3) * BLOCKS[id].photoSide, h = y - ly;
        if ((x - c.x) * Math.cos(a) + (z - c.z) * Math.sin(a) > 0.38 && h > 0.25 && h < 0.75) return { hit: { q, r, y: ly }, prev, t };
        last = '';
        continue;
      }
      if (isTorch(id)) {
        const c = hexToWorld(q, r);
        if (y - ly < 0.7 && (x - c.x) ** 2 + (z - c.z) ** 2 < 0.04) return { hit: { q, r, y: ly }, prev, t };
      }
      // levier et pousse : on vise leur volume, plus petit que la case
      const small = BLOCKS[id]?.lever || BLOCKS[id]?.sapling;
      if (small) {
        const c = hexToWorld(q, r);
        if (y - ly < 0.75 && (x - c.x) ** 2 + (z - c.z) ** 2 < 0.13) return { hit: { q, r, y: ly }, prev, t };
      }
      if (isRail(id) || isWire(id) || isTorch(id) || small || BLOCKS[id]?.repeater || BLOCKS[id]?.track !== undefined) { last = ''; continue; } // on teste chaque pas dans leur case
      prev = { q, r, y: ly };
    }
    return null;
  }

  // Distance libre le long d'un rayon (pour la caméra 3e personne).
  clearDistance(origin, dir, maxDist) {
    for (let t = 0; t <= maxDist; t += 0.05) {
      const { q, r } = worldToHex(origin.x + dir.x * t, origin.z + dir.z * t);
      if (this.isSolid(q, r, Math.floor(origin.y + dir.y * t))) return Math.max(0, t - 0.2);
    }
    return maxDist;
  }
}
