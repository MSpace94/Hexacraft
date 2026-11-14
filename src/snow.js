// Neige au sol : quand il neige et qu'il gèle, des couches de neige (voir SNOW_LAYER dans
// blocks.js) se posent sur le dessus des blocs à ciel ouvert autour du joueur, et s'épaississent ;
// quand il fait doux, elles fondent peu à peu. Jamais sous un bloc : seulement sur le plus haut
// bloc de la colonne. (sur l'hôte : les couches sont des blocs, transmis comme les autres)
import { worldToHex, hexToWorld } from './hex.js?v=1.1.5-alpha-mwgq2wrb';
import { AIR, TALL_GRASS, SNOW_LAYER, isSnowLayer, holdsSnow, isWater, isLava } from './blocks.js?v=1.1.5-alpha-mwgq2wrb';
import { CS, H, chunkKey } from './mesher.js?v=1.1.5-alpha-mwgq2wrb';

const REACH = 40;      // rayon autour du joueur (cases)
const FALL = 90;       // colonnes tirées au sort par seconde, quand il neige fort
const MELT = 40;       // colonnes par seconde, quand il fait doux
// (par paquets : toutes les EVERY secondes, quelques chunks reçoivent leur part d'un coup ; un
// flocon par-ci par-là ferait refaire sans cesse tous les chunks alentour)
const EVERY = 2, CHUNKS = 2;
const MAX_NATURAL = 4; // épaisseur que la neige atteint d'elle-même (8 en la posant à la main)

export class SnowCover {
  constructor(world, seasons) {
    this.world = world;
    this.seasons = seasons;
    this.timer = 0;
  }

  // weather : la météo ; at : le joueur, ou les joueurs (en ligne : l'hôte et ses invités ; la
  // neige tombe autour de chacun, tour à tour)
  update(dt, weather, at) {
    const all = Array.isArray(at) ? at : [at];
    this.turn = ((this.turn || 0) + 1) % 1e6;
    const pos = all[this.turn % all.length];
    if (!pos) return;
    const snowing = weather.snow && weather.rain > 0.05;
    const t = this.seasons.tempAt(pos.x, pos.y, pos.z, false); // (dehors, même si le joueur est sous terre)
    // (il neige sans geler, ou il fait froid sans neiger : rien ne change)
    const rate = snowing && t < 1 ? FALL * Math.min(1, weather.rain) : t > 1 ? MELT * Math.min(1, (t - 1) / 6) : 0;
    if ((this.timer += dt) < EVERY) return;
    this.timer = 0;
    if (!rate) return;
    const per = Math.round((rate * EVERY) / CHUNKS);
    for (let c = 0; c < CHUNKS; c++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * REACH;
      const h = worldToHex(pos.x + Math.cos(a) * d, pos.z + Math.sin(a) * d);
      const cq = Math.floor(h.q / CS), cr = Math.floor(h.r / CS);
      if (!this.world.chunks.get(chunkKey(cq, cr))?.data) continue;
      for (let i = 0; i < per; i++) {
        const q = cq * CS + Math.floor(Math.random() * CS), r = cr * CS + Math.floor(Math.random() * CS);
        const y = this.top(q, r);
        if (y === null) continue;
        const id = this.world.getBlock(q, r, y), p = hexToWorld(q, r), cold = this.seasons.tempAt(p.x, y, p.z) < 1;
        if (snowing && cold) this.fall(q, r, y, id);
        else if (!cold && isSnowLayer(id)) this.world.setBlock(q, r, y, id === SNOW_LAYER ? AIR : id - 1);
      }
    }
  }

  // Plus haut bloc de la colonne (q, r), ou null
  top(q, r) {
    for (let y = H - 1; y > 0; y--) if (this.world.getBlock(q, r, y) !== AIR) return y;
    return null;
  }

  // Un flocon de plus sur le bloc id en (q, r, y), le plus haut de sa colonne
  fall(q, r, y, id) {
    const w = this.world;
    if (isSnowLayer(id)) {
      if (id < SNOW_LAYER + MAX_NATURAL - 1) w.setBlock(q, r, y, id + 1);
      return;
    }
    // (l'herbe haute disparaît sous la neige)
    if (id === TALL_GRASS && holdsSnow(w.getBlock(q, r, y - 1))) { w.setBlock(q, r, y, SNOW_LAYER); return; }
    if (isWater(id) || isLava(id) || !holdsSnow(id) || y + 1 >= H) return;
    w.setBlock(q, r, y + 1, SNOW_LAYER);
  }
}
