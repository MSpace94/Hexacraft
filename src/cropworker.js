// Recadrage des images des objets, à côté du jeu (voir loadItemImages dans main.js) : chaque
// image est lue, puis on cherche le cadre de sa partie dessinée (alpha >= 16). Plusieurs de ces
// threads travaillent en même temps : au démarrage, c'était le plus long (plus de 1000 images de
// 512 à 1024 px, lues pixel par pixel l'une après l'autre).
self.onmessage = async ({ data: { k, src } }) => {
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(res.status);
    const bmp = await createImageBitmap(await res.blob());
    const W = bmp.width, H = bmp.height;
    const c = new OffscreenCanvas(W, H);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    const box = opaqueBox(new Uint32Array(ctx.getImageData(0, 0, W, H).data.buffer), W, H);
    self.postMessage({ k, bmp, box }, [bmp]);
  } catch {
    self.postMessage({ k, fail: true });
  }
};

// Le cadre [x0, y0, x1, y1] des pixels visibles, ou null. On part des bords et on s'arrête au
// premier pixel visible : seules les marges sont parcourues
function opaqueBox(px, W, H) {
  const on = (i) => (px[i] >>> 24) >= 16; // (octet alpha : le plus fort, en petit-boutiste)
  let y0 = 0;
  for (; y0 < H; y0++) { let hit = false; for (let x = 0, i = y0 * W; x < W; x++, i++) if (on(i)) { hit = true; break; } if (hit) break; }
  if (y0 === H) return null;
  let y1 = H - 1;
  for (; y1 > y0; y1--) { let hit = false; for (let x = 0, i = y1 * W; x < W; x++, i++) if (on(i)) { hit = true; break; } if (hit) break; }
  let x0 = 0;
  for (; x0 < W; x0++) { let hit = false; for (let y = y0; y <= y1; y++) if (on(y * W + x0)) { hit = true; break; } if (hit) break; }
  let x1 = W - 1;
  for (; x1 > x0; x1--) { let hit = false; for (let y = y0; y <= y1; y++) if (on(y * W + x1)) { hit = true; break; } if (hit) break; }
  return [x0, y0, x1, y1];
}
