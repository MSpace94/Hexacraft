import * as THREE from 'three';
import { CORNERS, NEIGHBORS, SIZE, hexToWorld, worldToHex } from './hex.js?v=1.1.5-alpha-mvm2b95g';
import { BLOCKS, AIR, WATER, WATER_FALL, SOLID, OPAQUE, ATTACHED, SLAB, SUPPORT, blockBox, isRail, isTorch, isWire, isWater, isPhysics, waterStrength, flowId, fallId, isIceWater, isWaterSource, isLava, lavaStrength, lavaFlowId, LAVA_FALL, inSolidPart } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
const LAVA = 72, COBBLE = 28, OBSIDIAN = 74;
import { Generator, GEN_CONTENT } from './gen.js?v=1.1.5-alpha-mvm2b95g';
import { createWaterMaterial } from './water.js?v=1.1.5-alpha-mvm2b95g';
import { CS, H, idx, chunkKey, unitKey, columnSurface, lodStep, Y_MIN } from './mesher.js?v=1.1.5-alpha-mvm2b95g';
import { LIGHT_M } from './light.js?v=1.1.5-alpha-mvm2b95g';
import { createJobHandler } from './jobs.js?v=1.1.5-alpha-mvm2b95g';

export { CS, H, Y_MIN };

// Profondeurs (sous-chunk du bas, -80 à -1 : voir mesher.js) : dessinées seulement pour les chunks
// à moins de DEEP_NEAR blocs du joueur quand il est à la surface (on ne les voit que par un
// trou), et pour tous les chunks complets quand il descend sous DEEP_Y. Retirées au-delà (avec
// une marge, pour ne pas les refaire sans cesse).
const DEEP_NEAR = 44, DEEP_Y = 24, DEEP_MARGIN = 24;

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
export function geometryFrom(arrays, release = false) {
  const g = new THREE.BufferGeometry();
  for (const [name, arr] of Object.entries(arrays)) {
    if (name === 'sphere') continue; // (sphère englobante déjà calculée : voir mesher.js)
    const a = name === 'index' ? new THREE.BufferAttribute(arr, 1) : new THREE.BufferAttribute(arr, ATTR_SIZE[name], arr instanceof Int8Array || arr instanceof Uint8Array); // (normales, ombrage sur un octet : normalisés)
    if (release) a.onUpload(releaseArray);
    if (name === 'index') g.setIndex(a); else g.setAttribute(name, a);
  }
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
    this.chunks = new Map();  // chunks complets : clé -> { cq, cr, data, mesh, water, rev, applied }
    this.lods = new Map();    // blocs simplifiés : clé -> { s, cq, cr, mesh, water }
    this.planKey = '';        // le plan de chargement n'est recalculé que si on change de chunk
    this.mods = new Map();    // clé chunk -> Map(index local -> id) : ce qui diffère du monde généré
    this.dirty = new Set();   // chunks chargés à remailler (modifiés)
    this.dirtyDeep = new Set();   // ... leurs profondeurs (quand elles sont dessinées)
    this.pendingDeep = new Map(); // profondeurs demandées aux threads (pas encore reçues)
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
        const w = new Worker(new URL('./worker.js?v=1.1.5-alpha-mvm2b95g', import.meta.url), { type: 'module' });
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
      if (job?.kind === 'deep') this.pendingDeep.delete(job.key);
      return;
    }
    if (m.epoch !== this.epoch) return; // résultat d'un ancien monde
    // Les maillages reçus sont mis en place petit à petit (voir drainResults) : les envoyer
    // tous d'un coup à la carte graphique faisait des à-coups en se déplaçant vite.
    // (un chunk remaillé après un bloc posé / cassé passe tout de suite : réactivité)
    if (m.type === 'mesh') this.applyResult(m);
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
      const chunk = { cq: m.cq, cr: m.cr, data, mesh: null, water: null, rev: 0, applied: 0, deep: null, deepRev: 0, deepApplied: 0 };
      this.chunks.set(k, chunk);
      this.applyChunkMesh(chunk, m.opaque, m.water, m.rails, m.glow, m.lights);
      if (m.deep) this.applyChunkMesh(chunk.deep = { mesh: null, water: null }, m.deep.opaque, m.deep.water, m.deep.rails, m.deep.glow, m.deep.lights, true);
      this.adoptRails(chunk);
      if (p && p.touched) { this.dirty.add(k); if (chunk.deep) this.dirtyDeep.add(k); }
      this.needCleanup = true;
    } else if (m.type === 'mesh') {
      const chunk = this.chunks.get(chunkKey(m.cq, m.cr));
      if (!chunk) return;
      if (m.sec === 0) {
        // profondeurs : nouvelles (pendingDeep) ou refaites après une modification
        const k = chunkKey(m.cq, m.cr);
        if (!chunk.deep) {
          if (!this.pendingDeep.has(k)) return; // plus voulues entre-temps
          chunk.deep = { mesh: null, water: null };
        } else if (m.rev < chunk.deepApplied) return; // réponse périmée
        if (this.pendingDeep.get(k)?.touched) this.dirtyDeep.add(k); // (modifiée pendant le calcul)
        this.pendingDeep.delete(k);
        chunk.deepApplied = m.rev;
        this.applyChunkMesh(chunk.deep, m.opaque, m.water, m.rails, m.glow, m.lights, true);
        return;
      }
      if (m.rev < chunk.applied) return; // réponse périmée
      chunk.applied = m.rev;
      this.applyChunkMesh(chunk, m.opaque, m.water, m.rails, m.glow, m.lights);
    } else if (m.type === 'lod') {
      if (this.pendingLod.get(m.key) !== m.token) return;
      this.pendingLod.delete(m.key);
      const u = this.units?.get(m.key);
      if (!u || this.lods.has(m.key)) return;
      const mesh = new THREE.Mesh(geometryFrom(m.opaque, true), this.lodMaterial());
      mesh.matrixAutoUpdate = false;
      mesh.visible = u.s !== 1 || !this.chunks.get(chunkKey(u.cq, u.cr))?.mesh;
      this.scene.add(mesh);
      const lod = { s: u.s, cq: u.cq, cr: u.cr, mesh, water: null };
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
    } else {
      chunk.mesh = new THREE.Mesh(geo, this.material);
      chunk.mesh.matrixAutoUpdate = false;
      chunk.mesh.castShadow = !deep;
      chunk.mesh.receiveShadow = !deep;
      this.scene.add(chunk.mesh);
      // (un chunk de la surface qui arrive à la place du terrain simplifié apparaît en fondu : voir fades)
      if (!deep && this.lodUnder(chunk.cq, chunk.cr)) { chunk.fadeT = performance.now(); chunk.mesh.material = this.fadeMaterials()[0]; this.fading.add(chunk); }
    }
    this.setWater(chunk, water);
    if (this.onMeshChange) this.onMeshChange();
  }

  // Remplace (ou crée / supprime) le maillage des rails d'un chunk.
  setRails(holder, arrays) {
    if (holder.rails) {
      holder.rails.geometry.dispose();
      if (arrays) { holder.rails.geometry = geometryFrom(arrays, true); return; }
      this.scene.remove(holder.rails);
      holder.rails = null;
      return;
    }
    if (!arrays) return;
    holder.rails = new THREE.Mesh(geometryFrom(arrays, true), this.railMaterial);
    holder.rails.matrixAutoUpdate = false;
    holder.rails.receiveShadow = true;
    this.scene.add(holder.rails);
  }

  // Remplace (ou crée / supprime) le maillage des torches d'un chunk.
  setGlow(holder, arrays) {
    if (holder.glow) {
      holder.glow.geometry.dispose();
      if (arrays) { holder.glow.geometry = geometryFrom(arrays, true); return; }
      this.scene.remove(holder.glow);
      holder.glow = null;
      return;
    }
    if (!arrays) return;
    holder.glow = new THREE.Mesh(geometryFrom(arrays, true), this.glowMaterial);
    holder.glow.matrixAutoUpdate = false;
    this.scene.add(holder.glow);
  }

  // Torches allumées autour de (x, z) : [{ x, y, z, d2, kind }], les plus proches d'abord
  lightsNear(x, z, max, radius = 48) {
    const out = [];
    const r2 = radius * radius;
    for (const c of this.chunks.values()) {
      for (const l of [c.lights, c.deep?.lights]) {
      if (!l) continue;
      for (let i = 0; i < l.length; i += 4) {
        const dx = l[i] - x, dz = l[i + 2] - z, d2 = dx * dx + dz * dz;
        if (d2 < r2) out.push({ x: l[i], y: l[i + 1], z: l[i + 2], kind: l[i + 3], d2 });
      }
      }
    }
    out.sort((a, b) => a.d2 - b.d2);
    return out.length > max ? out.slice(0, max) : out;
  }

  // Remplace (ou crée / supprime) le maillage d'eau d'un objet { water }.
  setWater(holder, arrays) {
    if (holder.water) {
      holder.water.geometry.dispose();
      if (arrays) { holder.water.geometry = geometryFrom(arrays, true); return; }
      this.scene.remove(holder.water);
      holder.water = null;
      return;
    }
    if (!arrays) return;
    holder.water = new THREE.Mesh(geometryFrom(arrays, true), this.waterMaterial);
    holder.water.matrixAutoUpdate = false;
    this.scene.add(holder.water);
  }

  // ---------- Monde ----------
  // Distances : détail complet (r0), grands hexas x2 (r1), x4 jusqu'à la vue totale (r2).
  get lodRanges() {
    const v = this.viewDist;
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

  getBlock(q, r, y) {
    if (y < Y_MIN) return 4;
    if (y >= H) return AIR;
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
    if (y < Y_MIN || y >= H) return false;
    const old = this.getBlock(q, r, y);
    const cq = Math.floor(q / CS), cr = Math.floor(r / CS);
    const i = idx(q - cq * CS, r - cr * CS, y);
    const k = chunkKey(cq, cr);
    const c = this.chunks.get(k);
    if (c) c.data[i] = id;
    const p = this.pendingLoad.get(k);
    if (p) p.touched = true;

    let m = this.mods.get(k);
    if (!quiet && id === this.gen.block(q, r, y) && BLOCKS[id]?.track === undefined) {
      if (m) { m.delete(i); if (!m.size) this.mods.delete(k); }
      this.modBatch.push([k, i, -1]);
    } else {
      if (!m) this.mods.set(k, (m = new Map()));
      m.set(i, id);
      this.modBatch.push([k, i, id]);
    }

    const lq = q - cq * CS, lr = r - cr * CS;
    // sous-chunks touchés : celui de la case, et l'autre si elle est à sa limite (ses faces et sa
    // lumière en dépendent)
    const lit = BLOCKS[id]?.light || BLOCKS[old]?.light || (!quiet && !!OPAQUE[id] !== !!OPAQUE[old]);
    const reach = lit ? LIGHT_M + 1 : 1;
    const secs = (y < 0 ? 1 : 0) | (y >= -reach && y < reach ? 3 : 0) | (y >= 0 ? 2 : 0);
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
    if (!SUPPORT[id]) {
      const up = this.getBlock(q, r, y + 1);
      if (ATTACHED[up] && BLOCKS[up].wall === undefined) this.setBlock(q, r, y + 1, AIR);
      // torches murales accrochées sur ses côtés
      for (let k = 0; k < 6; k++) {
        const [dq, dr] = NEIGHBORS[k], n = this.getBlock(q + dq, r + dr, y);
        if (BLOCKS[n]?.wall === (k + 3) % 6) this.setBlock(q + dq, r + dr, y, AIR);
      }
    }
    return true;
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

  // secs : sous-chunks à refaire (1 : les profondeurs, 2 : la surface, 3 : les deux)
  markDirty(q, r, secs = 3) {
    const cq = Math.floor(q / CS), cr = Math.floor(r / CS);
    const k = chunkKey(cq, cr);
    const c = this.chunks.get(k);
    if (c) {
      if (secs & 2) this.dirty.add(k);
      if (secs & 1 && c.deep) this.dirtyDeep.add(k);
      const pd = secs & 1 && this.pendingDeep.get(k);
      if (pd) pd.touched = true;
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
    this.dropDeep(c);
    this.chunks.delete(k);
    this.dirty.delete(k);
    this.pendingDeep.delete(k);
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
    if (any) { this.changed = true; this.onRailsAdopted?.(); }
  }

  // La carte graphique a redémarré (contexte WebGL perdu) : les maillages du terrain sont refaits
  // (leurs sommets ont été libérés après l'envoi). Les blocs restent lisibles entre-temps
  // (générateur + modifications : voir getBlock).
  remeshAll() {
    for (const k of [...this.chunks.keys()]) this.unloadChunk(k);
    for (const k of [...this.lods.keys()]) this.removeLod(k);
    this.pendingLoad.clear();
    this.pendingLod.clear();
    this.fading?.clear();
    this.pendingDeep.clear();
    this.planKey = '';
    this.epoch++;          // (les réponses en route sont pour les anciens maillages)
    this.needSync = true;
  }

  // Retire les profondeurs dessinées d'un chunk
  dropDeep(c) {
    const d = c.deep;
    if (!d) return;
    for (const m of [d.mesh, d.water, d.rails, d.glow]) if (m) { this.scene.remove(m); m.geometry.dispose(); }
    c.deep = null;
    this.dirtyDeep.delete(chunkKey(c.cq, c.cr));
  }

  removeLod(k) {
    const l = this.lods.get(k);
    if (!l) return;
    this.scene.remove(l.mesh);
    l.mesh.geometry.dispose();
    if (l.water) { this.scene.remove(l.water); l.water.geometry.dispose(); }
    this.lods.delete(k);
  }

  reset() {
    for (const k of [...this.chunks.keys()]) this.unloadChunk(k);
    for (const k of [...this.lods.keys()]) this.removeLod(k);
    this.mods.clear();
    this.chunkVer.clear();
    this.waterQueue.clear();
    this.lavaQueue.clear();
    this.dirty.clear();
    this.dirtyDeep.clear();
    this.pendingLoad.clear();
    this.pendingLod.clear();
    this.fading?.clear();
    this.pendingDeep.clear();
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
    const [r0, , r2] = this.lodRanges;
    const { q, r } = worldToHex(px, pz);
    const pcq = Math.floor(q / CS), pcr = Math.floor(r / CS);
    this.viewX = px; this.viewZ = pz; // (d'où l'on regarde : les voies du train sont dessinées jusqu'à la vue, voir tracks.js)
    const key = pcq + ',' + pcr + ',' + r2;
    if (key === this.planKey) return;
    this.planKey = key;

    const cdist = (cq, cr) => {
      const hq = cq * CS + CS / 2, hr = cr * CS + CS / 2;
      return Math.hypot(SIZE * SQ3 * (hq + hr / 2) - px, SIZE * 1.5 * hr - pz);
    };
    const fullWant = [], fullKeep = new Set(), units = new Map();
    const addUnit = (s, cq, cr, d) => units.set(unitKey(s, cq, cr), { s, cq, cr, d });
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
    fullWant.sort((a, b) => a[0] - b[0]);
    // chunks gardés en mémoire par chaque thread : ceux de la zone en détail, ses voisins (lumière)
    // et une marge (surface d'un chunk : 16 x 16 cases de 0,866)
    const cap = Math.max(160, Math.min(1400, Math.ceil((Math.PI * (r0 + MARGIN + 2 * CS) ** 2) / (CS * CS * 0.866) * 1.25) + 24));
    if (cap !== this.cacheCap) { this.cacheCap = cap; this.broadcast({ type: 'cap', n: cap }); }
    this.fullWant = fullWant;
    this.fullKeep = fullKeep;
    this.units = units;
    this.unitQueue = [...units.entries()].sort((a, b) => a[1].d - b[1].d);
    this.needCleanup = true;
  }

  // Distribue le travail aux threads (le plus proche d'abord). Aucun calcul lourd ici.
  // py : hauteur du joueur (profondeurs dessinées plus loin quand il est sous terre)
  update(px, pz, py = 64) {
    this.drainResults();
    this.flushWorkers();
    this.fades();
    this.plan(px, pz);
    // profondeurs voulues : jusqu'à deepR blocs (le tutoriel n'en a pas, le monde plat n'a que de
    // la bedrock dessous)
    const deepR = (this.gen.type !== 'normal' && this.gen.type !== 'flat') || this.surfaceOnly ? -1 : py < DEEP_Y ? this.lodRanges[0] : DEEP_NEAR;
    const deepWant = (d) => d < deepR;

    // 1. chunks modifiés (réactivité quand on casse / pose un bloc)
    for (const k of this.dirty) {
      const c = this.chunks.get(k);
      if (!c) { this.dirty.delete(k); continue; }
      if (!this.send({ type: 'mesh', cq: c.cq, cr: c.cr, rev: c.rev + 1, sec: 1 }, 'mesh', k)) break;
      c.rev++;
      this.dirty.delete(k);
    }
    for (const k of this.dirtyDeep) {
      const c = this.chunks.get(k);
      if (!c || !c.deep) { this.dirtyDeep.delete(k); continue; }
      if (!this.send({ type: 'mesh', cq: c.cq, cr: c.cr, rev: c.deepRev + 1, sec: 0 }, 'mesh', k)) break;
      c.deepRev++;
      this.dirtyDeep.delete(k);
    }

    // 2. chunks complets à générer (avec leurs profondeurs, si on les dessine déjà à cette distance)
    for (const [d, cq, cr] of this.fullWant) {
      const k = chunkKey(cq, cr);
      if (this.chunks.has(k) || this.pendingLoad.has(k)) continue;
      if (!this.chunkVer.has(k)) { this.chunkVer.set(k, GEN_CONTENT); this.changed = true; }
      if (!this.send({ type: 'chunk', cq, cr, deep: deepWant(d) }, 'chunk', k)) break;
      this.pendingLoad.set(k, { touched: false });
    }

    // 2 bis. profondeurs des chunks déjà là (le joueur s'approche, ou descend sous terre) ;
    // retirées quand il s'éloigne
    if (deepR > 0) {
      const cdist = this.chunkDist(px, pz);
      for (const [d, cq, cr] of this.fullWant) {
        if (!deepWant(d)) break; // (les plus proches d'abord)
        const k = chunkKey(cq, cr), c = this.chunks.get(k);
        if (!c || c.deep || this.pendingDeep.has(k)) continue;
        if (!this.send({ type: 'mesh', cq, cr, rev: c.deepRev, sec: 0 }, 'deep', k)) break;
        this.pendingDeep.set(k, { touched: false });
      }
      if ((this.deepCheck = (this.deepCheck || 0) + 1) % 30 === 0) {
        for (const c of this.chunks.values()) if (c.deep && cdist(c.cq, c.cr) > deepR + DEEP_MARGIN) this.dropDeep(c);
        for (const k of [...this.pendingDeep.keys()]) {
          const [cq, cr] = k.split(',').map(Number);
          if (cdist(cq, cr) > deepR + DEEP_MARGIN) this.pendingDeep.delete(k);
        }
      }
    }

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
      if (l.s !== 1) continue;
      const c = this.chunks.get(chunkKey(l.cq, l.cr));
      l.mesh.visible = !c?.mesh || !!c.fadeT;
      if (l.water) l.water.visible = l.mesh.visible;
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
    let prev = null, last = '', slabKey = '', slabPrev = null;
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
