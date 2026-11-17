// Les petits canevas 2D (icônes, textures des blocs, vignettes des mondes) restent en mémoire
// ordinaire au lieu de la carte graphique : si elle plante (pilote, mémoire pleine), Chromium
// relance son processus et efface tout ce qu'il gardait. Les icônes devenaient noires, et les
// textures renvoyées à la carte au redémarrage aussi. Les grands canevas redessinés sans arrêt
// (carte, écran) restent accélérés, ils se refont d'eux-mêmes.
const SMALL = 1024 * 1024;
const getContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type, opts) {
  if (type === '2d' && this.width * this.height <= SMALL && !(opts && 'willReadFrequently' in opts)) {
    opts = { ...opts, willReadFrequently: true };
  }
  return getContext.call(this, type, opts);
};
