// Effets par-dessus l'écran (en feu, gelé), joués depuis des GIF animés : une animation
// d'entrée (jouée une fois), une boucle tant que l'effet dure, une animation de sortie.
// Les images sont décodées une à une au moment de les montrer (ImageDecoder) : rien n'est
// gardé en mémoire, et on contrôle le début, la fin et l'enchaînement des animations.

// Durée (s) de chaque image d'un GIF, lue dans le fichier (sans rien décoder)
function gifDelays(b) {
  const out = [];
  let p = 13, delay = 0.08;
  if (b[10] & 0x80) p += 3 * (1 << ((b[10] & 7) + 1));
  const skip = () => { while (p < b.length && b[p] !== 0) p += b[p] + 1; p++; };
  while (p < b.length) {
    if (b[p] === 0x21) {
      // extension (0xF9 : contrôle de l'image suivante, avec son délai en centièmes)
      if (b[p + 1] === 0xF9) delay = (b[p + 4] | (b[p + 5] << 8)) / 100;
      p += 2;
      skip();
    } else if (b[p] === 0x2C) {
      out.push(Math.max(0.02, delay || 0.1));
      const lf = b[p + 9];
      p += 10;
      if (lf & 0x80) p += 3 * (1 << ((lf & 7) + 1));
      p++; // (taille LZW)
      skip();
    } else break; // fin (0x3B)
  }
  return out;
}

class Gif {
  constructor(url) {
    this.count = 0;
    this.durations = [];   // durée de chaque image (s)
    this.decoder = null;
    this.ready = this.load(url).catch(() => null);
  }

  async load(url) {
    if (typeof ImageDecoder === 'undefined') return;
    const data = await (await fetch(url)).arrayBuffer();
    this.durations = gifDelays(new Uint8Array(data));
    const dec = new ImageDecoder({ data, type: 'image/gif' });
    await dec.tracks.ready;
    await dec.completed;
    this.count = Math.min(dec.tracks.selectedTrack.frameCount, this.durations.length);
    this.durations.length = this.count;
    this.total = this.durations.reduce((a, b) => a + b, 0);
    this.decoder = dec;
  }

  // Image à l'instant t (s) depuis le début ; loop : en boucle, sinon -1 une fois finie
  frameAt(t, loop) {
    if (!this.count) return -1;
    if (loop) t %= this.total;
    else if (t >= this.total) return -1;
    for (let i = 0; i < this.count; i++) {
      t -= this.durations[i];
      if (t < 0) return i;
    }
    return this.count - 1;
  }
}

// Un effet : { start, loop, end } (adresses des GIF), dessiné dans le canevas canvas
export class OverlayFx {
  constructor(canvas, files) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gifs = { start: new Gif(files.start), loop: new Gif(files.loop), end: new Gif(files.end) };
    this.phase = 'off';    // off | start | loop | end
    this.t = 0;
    this.shown = -1;       // image affichée ("phase:index")
    this.busy = false;
  }

  // on : l'effet doit-il être là ? dt : temps écoulé (s)
  update(on, dt) {
    const g = this.gifs;
    if (on && (this.phase === 'off' || this.phase === 'end')) this.go('start');
    else if (!on && (this.phase === 'start' || this.phase === 'loop')) this.go('end');
    if (this.phase === 'off') return;
    this.t += dt;
    let f = g[this.phase].frameAt(this.t, this.phase === 'loop');
    if (f < 0) {
      // animation d'entrée finie : la boucle ; de sortie : plus rien
      if (this.phase === 'start') { this.go('loop'); f = g.loop.frameAt(0, true); }
      else { this.go('off'); return; }
    }
    if (f < 0) return; // (GIF pas encore chargé)
    this.draw(this.phase, f);
  }

  go(phase) {
    this.phase = phase;
    this.t = 0;
    if (phase === 'off') {
      this.shown = -1;
      this.canvas.style.display = 'none';
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  // Décode et dessine l'image f de la phase (une seule à la fois ; on saute celles qu'on
  // n'a pas eu le temps de montrer)
  draw(phase, f) {
    const key = phase + ':' + f;
    if (key === this.shown || this.busy) return;
    const dec = this.gifs[phase].decoder;
    if (!dec) return;
    this.busy = true;
    dec.decode({ frameIndex: f }).then(({ image }) => {
      this.busy = false;
      if (this.phase !== phase) { image.close(); return; }
      const c = this.canvas;
      if (c.width !== image.displayWidth || c.height !== image.displayHeight) {
        c.width = image.displayWidth; c.height = image.displayHeight;
      }
      this.ctx.clearRect(0, 0, c.width, c.height);
      this.ctx.drawImage(image, 0, 0);
      image.close();
      c.style.display = 'block';
      this.shown = key;
    }).catch(() => { this.busy = false; });
  }

  stop() { this.go('off'); }
}
