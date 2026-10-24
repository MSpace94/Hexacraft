// Thread de travail : génère les chunks et construit leurs maillages en parallèle
// du jeu, pour que le thread principal ne fasse que la physique et l'affichage.
import { createJobHandler } from './jobs.js?v=1.1.5-alpha-mvm2b95g';

const handle = createJobHandler();

self.onmessage = (e) => {
  const msg = e.data;
  try {
    const out = handle(msg);
    if (out) self.postMessage(out[0], out[1]);
  } catch (err) {
    // on prévient le thread principal pour qu'il ne reste pas en attente
    self.postMessage({ type: 'error', job: msg.job, error: String(err && err.stack || err) });
  }
};
