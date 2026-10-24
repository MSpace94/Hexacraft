// Objets en 3D : icônes de la barre et de l'inventaire, objet tenu en main (1re personne
// avec le bras du joueur, 3e personne dans la main du personnage).
//
//  - Blocs : vrai prisme hexagonal texturé (mêmes maillages que le monde).
//  - Objets dessinés en pixels hexagonaux (outils, bâton, colle...) : vrai modèle 3D, un
//    petit prisme hexagonal par case du dessin (voir hexmodel.js).
//  - Autres objets plats (rails...) : l'image est empilée en fines couches, ce qui lui donne
//    une épaisseur.
import * as THREE from 'three';
import { BLOCKS, ITEMS, isRail, isTorch, isWater } from './blocks.js?v=1.1.5-alpha-mvm2b95g';
import { buildStructArrays, MeshBuilder } from './mesher.js?v=1.1.5-alpha-mvm2b95g';
import { geometryFrom } from './world.js?v=1.1.5-alpha-mvm2b95g';
import { findHexGrid, buildHexModel } from './hexmodel.js?v=1.1.5-alpha-mvm2b95g';

export const ICON_SIZE = 128;   // taille réelle des icônes (affichées plus petites : bien nettes)
const LAYERS = 7;               // couches d'un objet plat
const THICK = 0.07;             // épaisseur d'un objet plat (pour 1 de large)

// Où et comment l'objet est tenu, dans le repère du bras (le bras pend vers -Y, l'avant
// est -Z). La main est au bout du bras.
const HAND_Y = -0.6;

// Outils tenus comme dans Minecraft : le manche dans le poing, l'outil qui monte en
// diagonale. Les images d'outils sont dessinées du manche (en bas à gauche) à la tête (en
// haut à droite) : on tourne ce diagonal vers `dir` et la face de l'image vers `face`.
const TOOL_AXIS = new THREE.Vector3(1, 1, 0).normalize();
const TOOL_SIDE = new THREE.Vector3(-1, 1, 0).normalize();
const TOOL_N = new THREE.Vector3(0, 0, 1);
// Bras en 1re personne (voir FirstPersonHand.update) : pour viser des directions à l'écran
const FP_ARM = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.62, 0.42, 0.22));
const FP_ARM_INV = FP_ARM.clone().invert();

// Prise de chaque outil. grip : point tenu le long du diagonal (le bout du manche est à
// -0.71, la tête à +0.71). fp / tp : direction de l'outil et côté vers lequel regarde sa
// face, en 1re personne (repère de l'écran) et en 3e personne (repère du bras).
const GRIPS = {
  // épée : tenue à la garde, lame droite vers le haut et un peu vers l'avant
  sword: {
    grip: -0.42, scale: 0.66,
    fp: { dir: [-0.22, 0.92, -0.32], face: [-0.62, 0.05, 0.78] },
    tp: { dir: [0, 1, -1.25], face: [-1, 0, 0] },
  },
  // pioche, hache, houe : tenues au bout du manche, la tête levée vers l'avant, prête à frapper
  pickaxe: {
    grip: -0.5, scale: 0.64,
    fp: { dir: [-0.42, 0.72, -0.56], face: [-0.45, 0.1, 0.89] },
    tp: { dir: [0, 1, -0.7], face: [-1, 0, 0] },
  },
  axe: {
    grip: -0.5, scale: 0.64,
    fp: { dir: [-0.5, 0.7, -0.5], face: [-0.22, 0.1, 0.97] },
    tp: { dir: [0, 1, -0.75], face: [-1, 0, 0] },
  },
  hoe: {
    grip: -0.52, scale: 0.64,
    fp: { dir: [-0.45, 0.7, -0.56], face: [-0.45, 0.1, 0.89] },
    tp: { dir: [0, 1, -0.65], face: [-1, 0, 0] },
  },
  // pelle : tenue plus bas sur le manche, presque droite, la lame vers l'avant
  shovel: {
    grip: -0.3, scale: 0.62,
    fp: { dir: [-0.12, 0.96, -0.26], face: [-0.72, 0.05, 0.69] },
    tp: { dir: [0, 1, -0.45], face: [-1, 0, 0] },
  },
};

function holdTool(m, kind, fp) {
  const g = GRIPS[kind] || GRIPS.pickaxe;
  const cfg = fp ? g.fp : g.tp;
  const dir = new THREE.Vector3(...cfg.dir).normalize();
  const face = new THREE.Vector3(...cfg.face);
  if (fp) { dir.applyQuaternion(FP_ARM_INV); face.applyQuaternion(FP_ARM_INV); }
  face.addScaledVector(dir, -face.dot(dir)).normalize();
  const side = new THREE.Vector3().crossVectors(face, dir);
  // base de l'image (axe, côté, normale) -> base voulue (dir, côté, face)
  const from = new THREE.Matrix4().makeBasis(TOOL_AXIS, TOOL_SIDE, TOOL_N);
  const to = new THREE.Matrix4().makeBasis(dir, side, face);
  m.quaternion.setFromRotationMatrix(to.multiply(from.transpose()));
  m.scale.setScalar(g.scale);
  // le point tenu arrive dans la main
  const grip = TOOL_AXIS.clone().multiplyScalar(g.grip * g.scale).applyQuaternion(m.quaternion);
  m.position.set(0, HAND_Y - 0.02, -0.02).sub(grip);
}

export class Items {
  // world : textures et maillages des blocs ; images : { id: canvas } des objets
  constructor(world, images) {
    this.world = world;
    this.images = images;
    this.flatTextures = new Map();
    this.icons = new Map();
    // matériaux à part : partager ceux du terrain entre deux scènes (monde et main en
    // 1re personne) empêchait le terrain de s'afficher
    this.blockMaterial = world.material.clone();
    this.glowMaterial = world.glowMaterial.clone();
  }

  // ---------- Modèles ----------
  // Le bloc est-il montré comme un objet plat ? (rails : une plaque fine ne se voit pas)
  isFlat(id) { return !BLOCKS[id] || isRail(id) || BLOCKS[id].track !== undefined || !!BLOCKS[id].prop || !!BLOCKS[id].sapling || !!BLOCKS[id].lever; }

  // Image d'un objet plat (icône de l'objet, ou texture du rail)
  flatImage(id) {
    if (this.images[id]) return this.images[id];
    if (!BLOCKS[id]) return null;
    return this.world.atlas.tiles[BLOCKS[id].top] || null;
  }

  // Nouveau modèle 3D centré sur l'origine, d'environ 1 de haut
  model(id) {
    const g = new THREE.Group();
    if (!id) return g;
    if (this.isFlat(id)) {
      // dessin en pixels hexagonaux : vrai modèle 3D (un prisme par case)
      const hexGeo = this.hexGeometry(id);
      if (hexGeo) {
        this.hexMaterial ||= new THREE.MeshLambertMaterial({ vertexColors: true });
        const m = new THREE.Mesh(hexGeo, this.hexMaterial);
        m.castShadow = true;
        g.add(m);
        g.userData.flat = true;
        return g;
      }
      const tex = this.flatTexture(id);
      if (!tex) return g;
      const img = tex.image;
      const w = img.width >= img.height ? 1 : img.width / img.height;
      const h = img.height >= img.width ? 1 : img.height / img.width;
      const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
      const geo = new THREE.PlaneGeometry(w, h);
      for (let i = 0; i < LAYERS; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.position.z = (i / (LAYERS - 1) - 0.5) * THICK;
        m.castShadow = true;
        g.add(m);
      }
      g.userData.flat = true;
      return g;
    }
    if (isWater(id)) return this.waterModel(g);
    // four, coffre : la variante dont la face avant regarde la caméra des icônes (côté 2)
    const shown = BLOCKS[id].base !== undefined ? BLOCKS[id].base + 2 : id;
    const a = buildStructArrays([[0, 0, 0, shown]], this.world.uvTable);
    const add = (arrays, mat) => {
      if (!arrays) return;
      const m = new THREE.Mesh(geometryFrom(arrays), mat);
      // (une dalle est remontée pour être centrée comme un bloc)
      m.position.y = isTorch(id) ? -0.3 : BLOCKS[id].slab === 'bottom' ? -0.25 : -0.5;
      m.castShadow = true;
      g.add(m);
    };
    add(a.opaque, this.blockMaterial);
    add(a.glow, this.glowMaterial);
    // verre : texture à trous (transparence découpée, comme les rails)
    this.cutMaterial ||= new THREE.MeshLambertMaterial({ map: this.world.atlas.texture, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
    add(a.rails, this.cutMaterial);
    g.userData.torch = isTorch(id);
    return g;
  }

  // Eau : prisme bleu translucide (le maillage des blocs n'a pas de face pour l'eau)
  waterModel(g) {
    const uv = this.world.uvTable.water;
    const mb = new MeshBuilder();
    mb.cap(0, 1, 0, 1, uv.cap, null, true);
    mb.cap(0, 0, 0, 1, uv.cap, null, false);
    for (let i = 0; i < 6; i++) mb.side(i, 0, 0, 0, 1, 1, uv.side, 1, 1, 1, 1);
    this.waterMaterial ||= new THREE.MeshLambertMaterial({ map: this.world.atlas.texture, vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false });
    const m = new THREE.Mesh(geometryFrom(mb.arrays()), this.waterMaterial);
    m.position.y = -0.5;
    g.add(m);
    return g;
  }

  // Calcule à l'avance, un par un entre deux images, les modèles 3D des objets (pour ne pas
  // ralentir le jeu la première fois qu'on en prend un en main)
  prepareModels() {
    const ids = Object.keys(this.images).map(Number).filter((id) => !BLOCKS[id]);
    const next = () => {
      const id = ids.shift();
      if (id === undefined) return;
      this.hexGeometry(id);
      setTimeout(next, 30);
    };
    setTimeout(next, 500);
  }

  // Modèle 3D d'un objet dessiné sur une grille d'hexagones (ou null), calculé une fois
  hexGeometry(id) {
    this.hexGeos ||= new Map();
    if (this.hexGeos.has(id)) return this.hexGeos.get(id);
    let geo = null;
    const img = this.images[id];
    if (img && img.width >= 64) {
      const grid = findHexGrid(img);
      if (grid) geo = buildHexModel(grid);
    }
    this.hexGeos.set(id, geo);
    return geo;
  }

  flatTexture(id) {
    if (this.flatTextures.has(id)) return this.flatTextures.get(id);
    const img = this.flatImage(id);
    let tex = null;
    if (img) {
      tex = new THREE.CanvasTexture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      // pixel art : pixels nets de près, adouci de loin
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = 4;
    }
    this.flatTextures.set(id, tex);
    return tex;
  }

  // Place un modèle dans la main (repère du bras, voir HAND_Y). fp : 1re personne (le bras
  // est tendu vers l'avant, l'objet fait face à la caméra)
  placeInHand(m, id, fp = false) {
    if (!id) return;
    this.placeModel(m, id, fp);
    // petits objets ronds (boule de neige, charbon, caillou) : à leur taille dans la paume
    if (ITEMS[id]?.small) m.scale.multiplyScalar(0.55);
  }

  placeModel(m, id, fp) {
    // (grip : tenu comme cet outil sans en être un, ex. la clé à molette)
    if (m.userData.flat && (ITEMS[id]?.tool || ITEMS[id]?.grip)) {
      holdTool(m, ITEMS[id].grip || ITEMS[id].tool, fp);
    } else if (m.userData.flat && fp) {
      // objet plat vu de face, penché comme dans la main
      m.scale.setScalar(0.5);
      m.position.set(0.02, HAND_Y + 0.02, -0.22);
      m.rotation.set(-Math.PI / 2, 0, 0);
      m.rotateY(-0.35);
      m.rotateZ(0.12);
    } else if (m.userData.flat) {
      // objet plat vu de profil : tenu comme un outil, la pointe vers l'avant
      m.scale.setScalar(0.6);
      m.position.set(0, HAND_Y - 0.02, -0.2);
      m.rotation.set(0, Math.PI / 2, 0);
      m.rotateZ(-Math.PI / 4);
    } else if (fp && !m.userData.torch) {
      // bloc en 1re personne : posé sur la main, bien dégagé du bras
      m.scale.setScalar(0.24);
      m.position.set(-0.01, HAND_Y + 0.04, -0.26);
      m.rotation.set(-1.25, 0.5, 0);
    } else if (m.userData.torch) {
      m.scale.setScalar(0.7);
      m.position.set(0, HAND_Y - 0.02, -0.12);
      m.rotation.set(-1.2, 0, 0);
    } else {
      // bloc : petit prisme posé dans la paume
      m.scale.setScalar(0.3);
      m.position.set(0, HAND_Y - 0.1, -0.16);
      m.rotation.set(0.35, Math.PI / 6, 0);
    }
  }

  // Met l'objet `id` dans la main (bras : pivot d'épaule du personnage). Ne refait le
  // modèle que si l'objet change.
  attach(arm, id, fp = false) {
    let holder = arm.userData.holder;
    if (!holder) {
      holder = new THREE.Group();
      arm.add(holder);
      arm.userData.holder = holder;
    }
    if (holder.userData.id === id) return;
    holder.userData.id = id;
    holder.clear();
    if (!id) return;
    const m = this.model(id);
    this.placeInHand(m, id, fp);
    holder.add(m);
  }

  // ---------- Icônes ----------
  // Dessine en 3D les icônes des blocs (une seule fois, au démarrage)
  buildIcons(ids) {
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setSize(ICON_SIZE, ICON_SIZE, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(-0.4, 1, 0.55);
    scene.add(sun);
    // vue de trois quarts, légèrement plongeante : le dessus et deux côtés se voient
    const cam = new THREE.OrthographicCamera(-0.86, 0.86, 0.86, -0.86, 0.1, 10);
    const az = Math.PI / 6 + Math.PI / 2;
    cam.position.set(Math.cos(az) * 3, 2.1, Math.sin(az) * 3);
    cam.lookAt(0, 0, 0);
    for (const id of ids) {
      if (this.isFlat(id)) continue;
      const m = this.model(id);
      if (m.userData.torch) { m.scale.setScalar(2.1); m.position.y = -0.05; }
      scene.add(m);
      r.render(scene, cam);
      scene.remove(m);
      const c = document.createElement('canvas');
      c.width = c.height = ICON_SIZE;
      c.getContext('2d').drawImage(r.domElement, 0, 0);
      this.icons.set(id, c);
    }
    r.dispose();
    r.forceContextLoss();
  }

  // Icône (canvas) de taille affichée `size` px
  // shadow : ombre portée dessinée dans l'icône (une ombre CSS sur chaque case des menus
  // coûte cher à chaque image)
  icon(id, size = 40, shadow = false) {
    const c = document.createElement('canvas');
    c.width = c.height = ICON_SIZE;
    c.style.width = c.style.height = size + 'px';
    const ctx = c.getContext('2d');
    if (shadow) {
      const k = ICON_SIZE / size;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowOffsetY = 2 * k;
      ctx.shadowBlur = 3 * k;
    }
    const pre = this.icons.get(id);
    if (pre) { ctx.drawImage(pre, 0, 0); return c; }
    const img = this.flatImage(id);
    if (!img) return c;
    // objet plat : pixels nets si l'image est petite (texture de bloc), lissés si elle est grande
    ctx.imageSmoothingEnabled = img.width > ICON_SIZE;
    ctx.imageSmoothingQuality = 'high';
    const pad = this.images[id] ? 8 : 14;
    ctx.drawImage(img, pad, pad, ICON_SIZE - 2 * pad, ICON_SIZE - 2 * pad);
    return c;
  }
}

// ---------- Première personne ----------
// Le bras droit du joueur et l'objet tenu, dessinés par-dessus la scène (jamais coupés
// par un mur), avec la lumière du moment.
export class FirstPersonHand {
  constructor(items) {
    this.items = items;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.light = new THREE.DirectionalLight(0xffffff, 1);
    this.light.position.set(-0.5, 1, 0.3);
    this.scene.add(this.hemi, this.light);
    this.root = new THREE.Group();      // suit les mouvements (balancement, coup)
    this.scene.add(this.root);
    this.arm = new THREE.Group();       // pivot d'épaule, même repère que le bras du personnage
    this.root.add(this.arm);
    this.id = -1;
    this.swing = 0;
    this.swap = 0;
    this.bob = 0;
  }

  // Copie le bras droit du personnage (même skin)
  setArm(armR) {
    for (const m of [...this.arm.children]) if (m !== this.arm.userData.holder) this.arm.remove(m);
    if (!armR) return;
    for (const o of armR.children) {
      if (!o.isMesh) continue;
      const mat = (o.userData.lit || o.material).clone(); // (le vrai matériau, pas celui de la 1re personne)
      mat.colorWrite = true;
      mat.depthWrite = true;
      this.arm.add(new THREE.Mesh(o.geometry, mat));
    }
  }

  // Coup de bras (clic)
  punch() { this.swing = 1; }

  update(dt, id, { walk = 0, speed = 0, aspect = 1, light, ambient } = {}) {
    if (id !== this.id) {
      if (this.id !== -1) this.swap = 1; // l'objet change : petit mouvement de rangement
      this.id = id;
      this.items.attach(this.arm, id, true);
    }
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.swing = Math.max(0, this.swing - dt * 4);
    this.swap = Math.max(0, this.swap - dt * 5);
    this.bob += (Math.min(1, speed / 4.3) - this.bob) * Math.min(1, dt * 8);
    // position de base : épaule en bas à droite, bras tendu vers l'avant
    const s = Math.sin((1 - this.swing) * Math.PI);
    const bx = Math.sin(walk) * 0.03 * this.bob, by = -Math.abs(Math.cos(walk)) * 0.03 * this.bob;
    this.root.position.set(0.8 + bx - s * 0.14, -0.6 + by - this.swap * 0.35 + s * 0.08, -0.68 - s * 0.12);
    this.arm.rotation.set(1.62 - s * 0.6, 0.42, 0.22 + s * 0.3);
    if (light) {
      this.light.color.copy(light.color);
      this.light.intensity = light.intensity;
    }
    if (ambient) {
      this.hemi.color.copy(ambient.color);
      this.hemi.groundColor.copy(ambient.groundColor);
      this.hemi.intensity = ambient.intensity;
    }
  }
}
